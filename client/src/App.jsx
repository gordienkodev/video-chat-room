import { useState } from 'react'
import './styles.css'
import { APP_STATES } from './appStates.js'
import { ChatPanel } from './components/ChatPanel.jsx'
import { NameGate } from './components/NameGate.jsx'
import { ParticipantsList } from './components/ParticipantsList.jsx'
import { RoomView } from './components/RoomView.jsx'
import { Toolbar } from './components/Toolbar.jsx'
import { VideoTile } from './components/VideoTile.jsx'

function getInitialRoute() {
  const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9_-]{6,64})\/?$/)

  if (!match) {
    return {
      state: APP_STATES.START,
      roomId: '',
    }
  }

  return {
    state: APP_STATES.LINK_NAME,
    roomId: match[1],
  }
}

function App() {
  const [initialRoute] = useState(getInitialRoute)
  const [appState, setAppState] = useState(initialRoute.state)
  const [roomId, setRoomId] = useState(initialRoute.roomId)
  const [displayName, setDisplayName] = useState('')
  const [participants, setParticipants] = useState([])
  const [messages, setMessages] = useState([])
  const [media, setMedia] = useState({ audioEnabled: true, videoEnabled: true })

  const isUnsupported =
    !('mediaDevices' in navigator) || typeof window.RTCPeerConnection === 'undefined'

  function enterUnsupportedState() {
    setAppState(APP_STATES.UNSUPPORTED)
  }

  function handleCreateRoom(name) {
    if (isUnsupported) {
      enterUnsupportedState()
      return
    }

    const draftRoomId = crypto.randomUUID().slice(0, 8)
    setRoomId(draftRoomId)
    joinDraftRoom(name, draftRoomId)
  }

  function handleJoinRoom(name) {
    if (isUnsupported) {
      enterUnsupportedState()
      return
    }

    joinDraftRoom(name, roomId)
  }

  function joinDraftRoom(name, nextRoomId) {
    const normalizedName = name.trim()

    setDisplayName(normalizedName)
    setAppState(APP_STATES.JOINING)

    const self = {
      id: 'local-preview',
      name: normalizedName,
      media,
      isSelf: true,
    }

    setParticipants([self])
    setMessages([
      {
        id: 'welcome',
        type: 'system',
        text: 'Комната готова к подключению signaling server.',
        createdAt: Date.now(),
      },
    ])
    setRoomId(nextRoomId)
    setAppState(APP_STATES.ROOM)
  }

  function handleLeaveRoom() {
    setDisplayName('')
    setParticipants([])
    setMessages([])
    setMedia({ audioEnabled: true, videoEnabled: true })
    setAppState(APP_STATES.START)
  }

  function handleToggleAudio() {
    setMedia((current) => {
      const next = { ...current, audioEnabled: !current.audioEnabled }
      updateSelfMedia(next)
      return next
    })
  }

  function handleToggleVideo() {
    setMedia((current) => {
      const next = { ...current, videoEnabled: !current.videoEnabled }
      updateSelfMedia(next)
      return next
    })
  }

  function updateSelfMedia(nextMedia) {
    setParticipants((current) =>
      current.map((participant) =>
        participant.isSelf ? { ...participant, media: nextMedia } : participant,
      ),
    )
  }

  function handleSendMessage(text) {
    const trimmedText = text.trim()

    if (!trimmedText) {
      return
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: 'user',
        senderName: displayName,
        text: trimmedText,
        createdAt: Date.now(),
      },
    ])
  }

  if (appState === APP_STATES.UNSUPPORTED) {
    return (
      <main className="app-shell app-shell--centered">
        <section className="status-panel" aria-live="polite">
          <h1>WebRTC не поддерживается</h1>
          <p>Откройте приложение в современном браузере с поддержкой камеры и микрофона.</p>
          <button type="button" onClick={() => setAppState(initialRoute.state)}>
            Назад
          </button>
        </section>
      </main>
    )
  }

  if (appState === APP_STATES.FULL_ROOM) {
    return (
      <main className="app-shell app-shell--centered">
        <section className="status-panel" aria-live="polite">
          <h1>Комната заполнена</h1>
          <p>В комнате уже четыре участника.</p>
          <button type="button" onClick={() => setAppState(APP_STATES.START)}>
            На главный экран
          </button>
        </section>
      </main>
    )
  }

  if (appState === APP_STATES.SERVER_ERROR) {
    return (
      <main className="app-shell app-shell--centered">
        <section className="status-panel" aria-live="polite">
          <h1>Сервер недоступен</h1>
          <p>Проверьте подключение и попробуйте войти снова.</p>
          <button type="button" onClick={() => setAppState(initialRoute.state)}>
            Повторить
          </button>
        </section>
      </main>
    )
  }

  if (appState === APP_STATES.JOINING) {
    return (
      <main className="app-shell app-shell--centered">
        <section className="status-panel" aria-live="polite">
          <h1>Входим в комнату</h1>
          <p>Подготавливаем подключение.</p>
        </section>
      </main>
    )
  }

  if (appState === APP_STATES.ROOM) {
    return (
      <RoomView
        roomId={roomId}
        videoGrid={
          <div className="video-grid" aria-label="Видео участников">
            {participants.map((participant) => (
              <VideoTile key={participant.id} participant={participant} />
            ))}
          </div>
        }
        toolbar={
          <Toolbar
            audioEnabled={media.audioEnabled}
            videoEnabled={media.videoEnabled}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            onLeave={handleLeaveRoom}
          />
        }
        chatPanel={<ChatPanel messages={messages} onSendMessage={handleSendMessage} />}
        participantsList={<ParticipantsList participants={participants} />}
      />
    )
  }

  return (
    <main className="app-shell app-shell--centered">
      <NameGate
        mode={appState === APP_STATES.LINK_NAME ? 'join' : 'create'}
        roomId={roomId}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    </main>
  )
}

export default App
