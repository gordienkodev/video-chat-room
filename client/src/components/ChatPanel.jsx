import { useEffect, useRef, useState } from 'react'

function formatMessageTime(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function ChatPanel({ messages, onSendMessage }) {
  const [text, setText] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  function handleSubmit(event) {
    event.preventDefault()

    const trimmedText = text.trim()

    if (!trimmedText) {
      return
    }

    onSendMessage(trimmedText)
    setText('')
  }

  return (
    <section className="chat-panel" aria-labelledby="chat-title">
      <h2 id="chat-title">Чат</h2>
      <div className="message-list" ref={listRef} role="log" aria-live="polite">
        {messages.map((message) => (
          <article className={`message message--${message.type}`} key={message.id}>
            <div className="message-meta">
              <span>{message.type === 'system' ? 'Система' : message.senderName}</span>
              <time dateTime={new Date(message.createdAt).toISOString()}>
                {formatMessageTime(message.createdAt)}
              </time>
            </div>
            <p>{message.text}</p>
          </article>
        ))}
      </div>
      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          maxLength={1000}
          placeholder="Сообщение"
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit">Отправить</button>
      </form>
    </section>
  )
}

export { ChatPanel }
