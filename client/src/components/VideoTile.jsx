import { useEffect, useRef } from 'react'

function VideoTile({ participant, stream }) {
  const media = participant.media ?? { audioEnabled: false, videoEnabled: false }
  const videoRef = useRef(null)
  const isVideoVisible = Boolean(stream && media.videoEnabled)
  const tileClassName = participant.isSelf ? 'video-tile video-tile--self' : 'video-tile'

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null
    }
  }, [stream])

  return (
    <article className={tileClassName}>
      {isVideoVisible ? (
        <video
          ref={videoRef}
          aria-label={`Видео: ${participant.name}`}
          autoPlay
          muted={participant.isSelf}
          playsInline
        />
      ) : (
        <div className="video-placeholder" aria-label={`Камера выключена: ${participant.name}`}>
          <span className="avatar-silhouette" aria-hidden="true" />
        </div>
      )}
      <div className="video-overlay">
        <span className="participant-name">
          {participant.name}
          {participant.isSelf ? <span className="self-label">Вы</span> : null}
        </span>
        {!media.audioEnabled ? (
          <span className="muted-mic-icon" aria-label="Микрофон выключен">
            <span className="sr-only">Микрофон выключен</span>
          </span>
        ) : null}
      </div>
      {!media.videoEnabled ? <span className="camera-badge">Камера выключена</span> : null}
      {participant.connectionState === 'failed' ? (
        <span className="connection-badge">Медиасоединение недоступно</span>
      ) : null}
    </article>
  )
}

export { VideoTile }
