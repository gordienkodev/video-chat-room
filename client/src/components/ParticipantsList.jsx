function ParticipantsList({ participants }) {
  return (
    <section className="participants-panel" aria-labelledby="participants-title">
      <h2 id="participants-title">Участники</h2>
      <ul>
        {participants.map((participant) => (
          <li key={participant.id}>
            <span>{participant.name}</span>
            {participant.isSelf ? <strong>Вы</strong> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

export { ParticipantsList }
