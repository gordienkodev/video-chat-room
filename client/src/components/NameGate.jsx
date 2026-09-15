import { useState } from 'react'
import { validateName } from '../nameValidation.js'

function NameGate({ mode, roomId, onCreateRoom, onJoinRoom }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const isJoinMode = mode === 'join'

  function handleSubmit(event) {
    event.preventDefault()

    const validationError = validateName(name)

    if (validationError) {
      setError(validationError)
      return
    }

    setError('')

    if (isJoinMode) {
      onJoinRoom(name)
      return
    }

    onCreateRoom(name)
  }

  return (
    <section className="name-gate" aria-labelledby="name-gate-title">
      <div>
        <p className="eyebrow">{isJoinMode ? `Комната ${roomId}` : 'Video Chat Room'}</p>
        <h1 id="name-gate-title">{isJoinMode ? 'Введите имя для входа' : 'Создать комнату'}</h1>
      </div>

      <form className="name-form" onSubmit={handleSubmit}>
        <label htmlFor="display-name">Имя</label>
        <input
          id="display-name"
          name="display-name"
          type="text"
          value={name}
          maxLength={30}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit">{isJoinMode ? 'Войти' : 'Создать'}</button>
      </form>
    </section>
  )
}

export { NameGate }
