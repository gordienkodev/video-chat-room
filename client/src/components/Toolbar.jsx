function Toolbar({
  audioEnabled,
  copyStatus,
  videoEnabled,
  onCopyLink,
  onToggleAudio,
  onToggleVideo,
  onLeave,
}) {
  const copyTitle = copyStatus === 'copied' ? 'Ссылка скопирована' : 'Скопировать ссылку'

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
      <button
        type="button"
        className={copyStatus === 'copied' ? 'copy-button is-copied' : 'copy-button'}
        onClick={onCopyLink}
        title={copyTitle}
      >
        {copyStatus === 'copied' ? 'copied' : 'link'}
      </button>
      <button type="button" className="leave-button" onClick={onLeave} title="Выйти">
        Выйти
      </button>
      {copyStatus === 'failed' ? (
        <span className="toolbar-status" role="status">
          Не удалось скопировать
        </span>
      ) : null}
    </nav>
  )
}

export { Toolbar }
