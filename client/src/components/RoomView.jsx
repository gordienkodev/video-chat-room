function RoomView({ roomId, videoGrid, toolbar, mediaStatus, chatPanel, participantsList }) {
  return (
    <main className="room-layout">
      <header className="room-header">
        <div>
          <p className="eyebrow">Комната</p>
          <h1>{roomId}</h1>
        </div>
        {toolbar}
      </header>

      {mediaStatus ? (
        <p className="media-status" role="status">
          {mediaStatus}
        </p>
      ) : null}

      <section className="room-stage">{videoGrid}</section>

      <aside className="room-sidebar">
        {participantsList}
        {chatPanel}
      </aside>
    </main>
  )
}

export { RoomView }
