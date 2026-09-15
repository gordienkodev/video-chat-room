const GOOGLE_STUN_CONFIG = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
  ],
}

function createPeerManager({
  localStream = null,
  onIceStateChange = () => {},
  onRemoteStream = () => {},
  peerConnectionFactory = createDefaultPeerConnection,
  socketClient,
} = {}) {
  if (!socketClient) {
    throw new TypeError('createPeerManager requires socketClient')
  }

  const peers = new Map()
  let currentLocalStream = localStream

  function ensurePeer(participantId) {
    if (!participantId) {
      throw new TypeError('participantId is required')
    }

    const existingPeer = peers.get(participantId)
    if (existingPeer) {
      return existingPeer
    }

    const connection = peerConnectionFactory()
    const peer = {
      connection,
      pendingCandidates: [],
      remoteStream: createRemoteStream(),
    }

    connection.onicecandidate = ({ candidate }) => {
      if (!candidate) {
        return
      }

      socketClient.sendIceCandidate({
        to: participantId,
        candidate: candidate.toJSON ? candidate.toJSON() : candidate,
      }).catch(() => {})
    }

    connection.ontrack = ({ streams = [], track }) => {
      const [eventStream] = streams
      const nextStream = eventStream || peer.remoteStream

      if (!eventStream && track && !nextStream.getTracks().includes(track)) {
        nextStream.addTrack(track)
      }

      peer.remoteStream = nextStream
      onRemoteStream(participantId, nextStream)
    }

    connection.oniceconnectionstatechange = () => {
      const state = connection.iceConnectionState
      onIceStateChange(participantId, state)
    }

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState
      if (state === 'failed') {
        onIceStateChange(participantId, state)
      }
    }

    peers.set(participantId, peer)
    syncLocalTracks(peer)

    return peer
  }

  function syncLocalTracks(peer) {
    const tracks = currentLocalStream?.getTracks() ?? []
    const senders = peer.connection.getSenders ? peer.connection.getSenders() : []

    senders.forEach((sender) => {
      if (sender.track && !tracks.includes(sender.track)) {
        peer.connection.removeTrack(sender)
      }
    })

    const activeSenders = peer.connection.getSenders ? peer.connection.getSenders() : []
    tracks.forEach((track) => {
      const isAlreadyAdded = activeSenders.some((sender) => sender.track === track)
      if (!isAlreadyAdded) {
        peer.connection.addTrack(track, currentLocalStream)
      }
    })
  }

  function setLocalStream(nextLocalStream) {
    currentLocalStream = nextLocalStream
    peers.forEach(syncLocalTracks)
  }

  async function createOfferForParticipant(participantId) {
    const peer = ensurePeer(participantId)
    const offer = await peer.connection.createOffer()
    await peer.connection.setLocalDescription(offer)
    await socketClient.sendOffer({
      to: participantId,
      description: serializeSessionDescription(peer.connection.localDescription),
    })
  }

  async function handleOffer({ from, description } = {}) {
    if (!from || !description) {
      return
    }

    const peer = ensurePeer(from)
    await peer.connection.setRemoteDescription(description)
    await flushPendingCandidates(peer)

    const answer = await peer.connection.createAnswer()
    await peer.connection.setLocalDescription(answer)
    await socketClient.sendAnswer({
      to: from,
      description: serializeSessionDescription(peer.connection.localDescription),
    })
  }

  async function handleAnswer({ from, description } = {}) {
    if (!from || !description) {
      return
    }

    const peer = peers.get(from)
    if (!peer) {
      return
    }

    await peer.connection.setRemoteDescription(description)
    await flushPendingCandidates(peer)
  }

  async function handleIceCandidate({ from, candidate } = {}) {
    if (!from || !candidate) {
      return
    }

    const peer = ensurePeer(from)

    if (!peer.connection.remoteDescription) {
      peer.pendingCandidates.push(candidate)
      return
    }

    await addIceCandidate(peer, candidate)
  }

  async function flushPendingCandidates(peer) {
    const candidates = peer.pendingCandidates.splice(0)

    await Promise.all(candidates.map((candidate) => addIceCandidate(peer, candidate)))
  }

  async function addIceCandidate(peer, candidate) {
    try {
      await peer.connection.addIceCandidate(candidate)
    } catch {
      onIceStateChange(getParticipantId(peer), 'failed')
    }
  }

  function getParticipantId(targetPeer) {
    for (const [participantId, peer] of peers.entries()) {
      if (peer === targetPeer) {
        return participantId
      }
    }

    return ''
  }

  function closePeer(participantId) {
    const peer = peers.get(participantId)

    if (!peer) {
      return
    }

    peer.connection.onicecandidate = null
    peer.connection.ontrack = null
    peer.connection.oniceconnectionstatechange = null
    peer.connection.onconnectionstatechange = null
    peer.connection.close()
    peers.delete(participantId)
  }

  function closeAll() {
    Array.from(peers.keys()).forEach(closePeer)
  }

  return {
    closeAll,
    closePeer,
    createOfferForParticipant,
    getPeerCount() {
      return peers.size
    },
    handleAnswer,
    handleIceCandidate,
    handleOffer,
    setLocalStream,
  }
}

function createDefaultPeerConnection() {
  return new RTCPeerConnection(GOOGLE_STUN_CONFIG)
}

function createRemoteStream() {
  return new MediaStream()
}

function serializeSessionDescription(description) {
  return description?.toJSON ? description.toJSON() : description
}

export { GOOGLE_STUN_CONFIG, createPeerManager }
