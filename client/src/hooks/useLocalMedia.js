import { useCallback, useMemo, useState } from 'react'

const EMPTY_MEDIA_STATE = {
  audioEnabled: false,
  videoEnabled: false,
}

function getMediaSupport() {
  const mediaDevices = globalThis.navigator?.mediaDevices

  return Boolean(
    mediaDevices?.getUserMedia && typeof globalThis.RTCPeerConnection !== 'undefined',
  )
}

function getStreamMediaState(stream) {
  return {
    audioEnabled: stream.getAudioTracks().some((track) => track.enabled && track.readyState === 'live'),
    videoEnabled: stream.getVideoTracks().some((track) => track.readyState === 'live'),
  }
}

async function requestMedia(constraints) {
  try {
    return await globalThis.navigator.mediaDevices.getUserMedia(constraints)
  } catch {
    return null
  }
}

function stopTracks(tracks) {
  tracks.forEach((track) => {
    track.stop()
  })
}

function mergeStreams(streams) {
  const mergedStream = new MediaStream()

  streams.forEach((stream) => {
    stream?.getTracks().forEach((track) => {
      mergedStream.addTrack(track)
    })
  })

  return mergedStream
}

function createEmptyStream() {
  return new MediaStream()
}

function useLocalMedia() {
  const isSupported = useMemo(() => getMediaSupport(), [])
  const [stream, setStream] = useState(null)
  const [media, setMedia] = useState(EMPTY_MEDIA_STATE)
  const [error, setError] = useState('')

  const replaceStream = useCallback((nextStream) => {
    setStream((currentStream) => {
      if (currentStream && currentStream !== nextStream) {
        stopTracks(currentStream.getTracks())
      }

      return nextStream
    })
  }, [])

  const startMedia = useCallback(async () => {
    if (!isSupported) {
      setError('Браузер не поддерживает WebRTC или доступ к камере и микрофону.')
      setMedia(EMPTY_MEDIA_STATE)
      replaceStream(null)
      return EMPTY_MEDIA_STATE
    }

    setError('')

    const fullStream = await requestMedia({ audio: true, video: true })
    if (fullStream) {
      const nextMedia = getStreamMediaState(fullStream)
      replaceStream(fullStream)
      setMedia(nextMedia)
      return nextMedia
    }

    const [audioStream, videoStream] = await Promise.all([
      requestMedia({ audio: true }),
      requestMedia({ video: true }),
    ])
    const nextStream = mergeStreams([audioStream, videoStream])
    const nextMedia = getStreamMediaState(nextStream)

    replaceStream(nextStream)
    setMedia(nextMedia)

    if (!nextMedia.audioEnabled || !nextMedia.videoEnabled) {
      setError('Не удалось получить доступ к камере или микрофону. Вход выполнится с выключенными устройствами.')
    }

    return nextMedia
  }, [isSupported, replaceStream])

  const toggleAudio = useCallback(() => {
    const audioTracks = stream?.getAudioTracks() ?? []
    const nextAudioEnabled = !media.audioEnabled

    if (audioTracks.length === 0) {
      const nextMedia = { ...media, audioEnabled: false }
      setMedia(nextMedia)
      setError('Микрофон недоступен.')
      return nextMedia
    }

    audioTracks.forEach((track) => {
      track.enabled = nextAudioEnabled
    })

    const nextMedia = { ...media, audioEnabled: nextAudioEnabled }
    setMedia(nextMedia)
    setError('')
    return nextMedia
  }, [media, stream])

  const toggleVideo = useCallback(async () => {
    if (!media.videoEnabled) {
      if (!isSupported) {
        const nextMedia = { ...media, videoEnabled: false }
        setMedia(nextMedia)
        setError('Браузер не поддерживает WebRTC или доступ к камере.')
        return nextMedia
      }

      const videoStream = await requestMedia({ video: true })

      if (!videoStream) {
        const nextMedia = { ...media, videoEnabled: false }
        setMedia(nextMedia)
        setError('Камера недоступна.')
        return nextMedia
      }

      const [videoTrack] = videoStream.getVideoTracks()
      if (!videoTrack) {
        stopTracks(videoStream.getTracks())
        const nextMedia = { ...media, videoEnabled: false }
        setMedia(nextMedia)
        setError('Камера недоступна.')
        return nextMedia
      }

      setStream((currentStream) => {
        const nextStream = currentStream ? new MediaStream(currentStream.getTracks()) : createEmptyStream()
        nextStream.addTrack(videoTrack)
        return nextStream
      })

      const nextMedia = { ...media, videoEnabled: true }
      setMedia(nextMedia)
      setError('')
      return nextMedia
    }

    const videoTracks = stream?.getVideoTracks() ?? []
    stopTracks(videoTracks)

    setStream((currentStream) => {
      if (!currentStream) {
        return currentStream
      }

      const nextStream = new MediaStream(currentStream.getTracks())
      videoTracks.forEach((track) => {
        nextStream.removeTrack(track)
      })

      return nextStream
    })

    const nextMedia = { ...media, videoEnabled: false }
    setMedia(nextMedia)
    return nextMedia
  }, [isSupported, media, stream])

  const stopMedia = useCallback(() => {
    replaceStream(null)
    setMedia(EMPTY_MEDIA_STATE)
    setError('')
  }, [replaceStream])

  return useMemo(() => ({
    error,
    isSupported,
    media,
    startMedia,
    stopMedia,
    stream,
    toggleAudio,
    toggleVideo,
  }), [error, isSupported, media, startMedia, stopMedia, stream, toggleAudio, toggleVideo])
}

export { useLocalMedia }
