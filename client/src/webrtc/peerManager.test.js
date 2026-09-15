import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPeerManager } from './peerManager.js'

class FakeMediaStream {
  constructor(tracks = []) {
    this.tracks = [...tracks]
  }

  addTrack(track) {
    this.tracks.push(track)
  }

  getTracks() {
    return [...this.tracks]
  }
}

class FakePeerConnection {
  constructor({ rejectIceCandidate = false } = {}) {
    this.addIceCandidate = vi.fn((candidate) => {
      if (rejectIceCandidate) {
        return Promise.reject(new Error('ICE candidate failed'))
      }

      this.iceCandidates.push(candidate)
      return Promise.resolve()
    })
    this.addTrack = vi.fn((track, stream) => {
      const sender = { track, stream }
      this.senders.push(sender)
      return sender
    })
    this.close = vi.fn()
    this.createAnswer = vi.fn(() => Promise.resolve({ sdp: 'answer-sdp', type: 'answer' }))
    this.createOffer = vi.fn(() => Promise.resolve({ sdp: 'offer-sdp', type: 'offer' }))
    this.getSenders = vi.fn(() => [...this.senders])
    this.iceCandidates = []
    this.iceConnectionState = 'new'
    this.connectionState = 'new'
    this.localDescription = null
    this.onconnectionstatechange = null
    this.onicecandidate = null
    this.oniceconnectionstatechange = null
    this.ontrack = null
    this.remoteDescription = null
    this.removeTrack = vi.fn((sender) => {
      this.senders = this.senders.filter((currentSender) => currentSender !== sender)
    })
    this.senders = []
    this.setLocalDescription = vi.fn((description) => {
      this.localDescription = description
      return Promise.resolve()
    })
    this.setRemoteDescription = vi.fn((description) => {
      this.remoteDescription = description
      return Promise.resolve()
    })
  }
}

function createTrack(kind) {
  return { kind, id: `${kind}-track` }
}

function createSocketClientMock() {
  return {
    sendAnswer: vi.fn(() => Promise.resolve()),
    sendIceCandidate: vi.fn(() => Promise.resolve()),
    sendOffer: vi.fn(() => Promise.resolve()),
  }
}

describe('createPeerManager', () => {
  const originalMediaStream = globalThis.MediaStream

  beforeEach(() => {
    globalThis.MediaStream = FakeMediaStream
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.MediaStream = originalMediaStream
  })

  it('creates one peer connection per participant and reuses it for later offers', async () => {
    const socketClient = createSocketClientMock()
    const connections = []
    const peerConnectionFactory = vi.fn(() => {
      const connection = new FakePeerConnection()
      connections.push(connection)
      return connection
    })
    const localStream = new FakeMediaStream([createTrack('audio'), createTrack('video')])
    const manager = createPeerManager({
      localStream,
      peerConnectionFactory,
      socketClient,
    })

    await manager.createOfferForParticipant('participant-1')
    await manager.createOfferForParticipant('participant-1')

    expect(peerConnectionFactory).toHaveBeenCalledTimes(1)
    expect(manager.getPeerCount()).toBe(1)
    expect(connections[0].createOffer).toHaveBeenCalledTimes(2)
  })

  it('adds local tracks and forwards remote tracks to the UI callback', async () => {
    const socketClient = createSocketClientMock()
    const connection = new FakePeerConnection()
    const onRemoteStream = vi.fn()
    const audioTrack = createTrack('audio')
    const videoTrack = createTrack('video')
    const localStream = new FakeMediaStream([audioTrack, videoTrack])
    const manager = createPeerManager({
      localStream,
      onRemoteStream,
      peerConnectionFactory: () => connection,
      socketClient,
    })

    await manager.handleOffer({
      from: 'participant-2',
      description: { sdp: 'remote-offer', type: 'offer' },
    })

    expect(connection.addTrack).toHaveBeenCalledWith(audioTrack, localStream)
    expect(connection.addTrack).toHaveBeenCalledWith(videoTrack, localStream)

    const remoteStream = new FakeMediaStream([createTrack('video')])
    connection.ontrack({ streams: [remoteStream] })

    expect(onRemoteStream).toHaveBeenCalledWith('participant-2', remoteStream)

    const fallbackTrack = createTrack('audio')
    connection.ontrack({ streams: [], track: fallbackTrack })

    expect(onRemoteStream).toHaveBeenLastCalledWith('participant-2', expect.any(FakeMediaStream))
    expect(onRemoteStream.mock.lastCall[1].getTracks()).toContain(fallbackTrack)
  })

  it('cleans up the participant peer connection when participant-left is handled', async () => {
    const socketClient = createSocketClientMock()
    const connection = new FakePeerConnection()
    const manager = createPeerManager({
      peerConnectionFactory: () => connection,
      socketClient,
    })

    await manager.createOfferForParticipant('participant-3')
    manager.closePeer('participant-3')

    expect(connection.onicecandidate).toBeNull()
    expect(connection.ontrack).toBeNull()
    expect(connection.oniceconnectionstatechange).toBeNull()
    expect(connection.onconnectionstatechange).toBeNull()
    expect(connection.close).toHaveBeenCalledTimes(1)
    expect(manager.getPeerCount()).toBe(0)
  })

  it('reports ICE failed state without rejecting the WebRTC event handler', async () => {
    const socketClient = createSocketClientMock()
    const connection = new FakePeerConnection({ rejectIceCandidate: true })
    const onIceStateChange = vi.fn()
    const manager = createPeerManager({
      onIceStateChange,
      peerConnectionFactory: () => connection,
      socketClient,
    })

    await manager.handleOffer({
      from: 'participant-4',
      description: { sdp: 'remote-offer', type: 'offer' },
    })

    connection.iceConnectionState = 'failed'
    connection.oniceconnectionstatechange()

    await expect(
      manager.handleIceCandidate({
        from: 'participant-4',
        candidate: { candidate: 'bad-candidate' },
      }),
    ).resolves.toBeUndefined()

    expect(onIceStateChange).toHaveBeenCalledWith('participant-4', 'failed')
  })
})
