function RoomView({ roomId, videoGrid, toolbar, chatPanel, participantsList }) {
  return (
    <main className="room-layout">
      <header className="room-header">
        <div>
          <p className="eyebrow">Комната</p>
          <h1>{roomId}</h1>
        </div>
        {toolbar}
      </header>

      <section className="room-stage">{videoGrid}</section>

      <aside className="room-sidebar">
        {participantsList}
        {chatPanel}
      </aside>
    </main>
  )
}

export { RoomView }
