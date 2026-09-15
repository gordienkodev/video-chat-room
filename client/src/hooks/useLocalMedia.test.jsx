import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalMedia } from './useLocalMedia.js'

class FakeMediaStream {
  constructor(tracks = []) {
    this.tracks = [...tracks]
  }

  addTrack(track) {
    this.tracks.push(track)
  }

  removeTrack(track) {
    this.tracks = this.tracks.filter((currentTrack) => currentTrack !== track)
  }

  getTracks() {
    return [...this.tracks]
  }

  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === 'audio')
  }

  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === 'video')
  }
}

function createTrack(kind) {
  return {
    enabled: true,
    kind,
    readyState: 'live',
    stop: vi.fn(function stop() {
      this.readyState = 'ended'
    }),
  }
}

describe('useLocalMedia', () => {
  const originalMediaStream = globalThis.MediaStream
  const originalRtcPeerConnection = globalThis.RTCPeerConnection
  const originalNavigator = globalThis.navigator

  beforeEach(() => {
    globalThis.MediaStream = FakeMediaStream
    globalThis.RTCPeerConnection = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.MediaStream = originalMediaStream
    globalThis.RTCPeerConnection = originalRtcPeerConnection
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
  })

  it('toggles audio track enabled state', async () => {
    const audioTrack = createTrack('audio')
    const videoTrack = createTrack('video')
    const stream = new FakeMediaStream([audioTrack, videoTrack])

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(stream),
        },
      },
    })

    const { result } = renderHook(() => useLocalMedia())

    await act(async () => {
      await result.current.startMedia()
    })

    expect(result.current.media).toEqual({ audioEnabled: true, videoEnabled: true })

    act(() => {
      result.current.toggleAudio()
    })

    expect(audioTrack.enabled).toBe(false)
    expect(result.current.media).toEqual({ audioEnabled: false, videoEnabled: true })
  })

  it('stops current video track when video is disabled', async () => {
    const audioTrack = createTrack('audio')
    const videoTrack = createTrack('video')
    const stream = new FakeMediaStream([audioTrack, videoTrack])

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(stream),
        },
      },
    })

    const { result } = renderHook(() => useLocalMedia())

    await act(async () => {
      await result.current.startMedia()
    })

    await act(async () => {
      await result.current.toggleVideo()
    })

    expect(videoTrack.stop).toHaveBeenCalled()
    expect(result.current.media).toEqual({ audioEnabled: true, videoEnabled: false })
  })
})

