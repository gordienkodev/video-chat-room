function VideoTile({ participant }) {
  const media = participant.media ?? { audioEnabled: false, videoEnabled: false }

  return (
    <article className="video-tile">
      <div className="video-placeholder" aria-hidden="true">
        {participant.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="video-overlay">
        <span>{participant.name}</span>
        <span aria-label={media.audioEnabled ? 'Микрофон включён' : 'Микрофон выключен'}>
          {media.audioEnabled ? 'mic' : 'mute'}
        </span>
      </div>
      {!media.videoEnabled ? <span className="camera-badge">Камера выключена</span> : null}
    </article>
  )
}

export { VideoTile }
