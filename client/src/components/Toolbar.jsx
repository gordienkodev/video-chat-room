function Toolbar({ audioEnabled, videoEnabled, onToggleAudio, onToggleVideo, onLeave }) {
  return (
    <nav className="toolbar" aria-label="Управление комнатой">
      <button
        type="button"
        className={audioEnabled ? '' : 'is-off'}
        onClick={onToggleAudio}
        aria-pressed={!audioEnabled}
        title={audioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
      >
        {audioEnabled ? 'mic' : 'mute'}
      </button>
      <button
        type="button"
        className={videoEnabled ? '' : 'is-off'}
        onClick={onToggleVideo}
        aria-pressed={!videoEnabled}
        title={videoEnabled ? 'Выключить камеру' : 'Включить камеру'}
      >
        {videoEnabled ? 'cam' : 'cam off'}
      </button>
      <button type="button" className="leave-button" onClick={onLeave} title="Выйти">
        Выйти
      </button>
    </nav>
  )
}

export { Toolbar }
