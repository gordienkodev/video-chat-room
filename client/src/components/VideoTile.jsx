import { useEffect, useRef } from 'react'

function VideoTile({ participant, stream }) {
  const media = participant.media ?? { audioEnabled: false, videoEnabled: false }
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null
    }
  }, [stream])

  return (
    <article className="video-tile">
      {stream && media.videoEnabled ? (
        <video
          ref={videoRef}
          aria-label={`Видео: ${participant.name}`}
          autoPlay
          muted={participant.isSelf}
          playsInline
        />
      ) : (
        <div className="video-placeholder" aria-hidden="true">
          {participant.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="video-overlay">
        <span>{participant.name}</span>
        <span aria-label={media.audioEnabled ? 'Микрофон включён' : 'Микрофон выключен'}>
          {media.audioEnabled ? 'mic' : 'mute'}
        </span>
      </div>
      {!media.videoEnabled ? <span className="camera-badge">Камера выключена</span> : null}
      {participant.connectionState === 'failed' ? (
        <span className="connection-badge">Медиасоединение недоступно</span>
      ) : null}
    </article>
  )
}

export { VideoTile }
