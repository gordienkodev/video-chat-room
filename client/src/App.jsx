import { useCallback, useEffect, useRef, useState } from 'react'
import './styles.css'
import { APP_STATES } from './appStates.js'
import { ChatPanel } from './components/ChatPanel.jsx'
import { NameGate } from './components/NameGate.jsx'
import { ParticipantsList } from './components/ParticipantsList.jsx'
import { RoomView } from './components/RoomView.jsx'
import { Toolbar } from './components/Toolbar.jsx'
import { VideoTile } from './components/VideoTile.jsx'
import { socketClient } from './socketClient.js'

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
  const [participants, setParticipants] = useState([])
  const [messages, setMessages] = useState([])
  const [media, setMedia] = useState({ audioEnabled: true, videoEnabled: true })
  const isLeavingRef = useRef(false)
  const selfIdRef = useRef('')
  const appStateRef = useRef(appState)

  const isUnsupported =
    !('mediaDevices' in navigator) || typeof window.RTCPeerConnection === 'undefined'

  const resetRoomState = useCallback(() => {
    selfIdRef.current = ''
    setParticipants([])
    setMessages([])
    setMedia({ audioEnabled: true, videoEnabled: true })
  }, [])

  useEffect(() => {
    appStateRef.current = appState
  }, [appState])

  useEffect(() => {
    const unsubscribeRoom = socketClient.subscribeRoomEvents({
      'room:participants': ({ participants: nextParticipants = [] } = {}) => {
        setParticipants(markSelfParticipant(nextParticipants, selfIdRef.current))
      },
    })
    const unsubscribeChat = socketClient.subscribeChatEvents({
      'chat:message': (message) => {
        setMessages((current) => [...current, message])
      },
    })
    const unsubscribeMedia = socketClient.subscribeMediaEvents({
      'media:updated': ({ participantId, media: nextMedia } = {}) => {
        setParticipants((current) =>
          current.map((participant) =>
            participant.id === participantId ? { ...participant, media: nextMedia } : participant,
          ),
        )
      },
    })
    const unsubscribeDisconnect = socketClient.onDisconnect(() => {
      if (isLeavingRef.current || appStateRef.current !== APP_STATES.ROOM) {
        return
      }

      resetRoomState()
      setAppState(APP_STATES.SERVER_ERROR)
    })
    const unsubscribeConnectError = socketClient.onConnectError(() => {
      if (appStateRef.current === APP_STATES.JOINING) {
        resetRoomState()
        setAppState(APP_STATES.SERVER_ERROR)
      }
    })

    return () => {
      unsubscribeRoom()
      unsubscribeChat()
      unsubscribeMedia()
      unsubscribeDisconnect()
      unsubscribeConnectError()
      socketClient.disconnect()
    }
  }, [resetRoomState])

  function enterUnsupportedState() {
    setAppState(APP_STATES.UNSUPPORTED)
  }

  async function handleCreateRoom(name) {
    if (isUnsupported) {
      enterUnsupportedState()
      return
    }

    const normalizedName = name.trim()
    prepareJoining()

    try {
      const createResult = await socketClient.createRoom()

      if (!createResult?.ok) {
        throw new Error(createResult?.message || 'Room creation failed')
      }

      await joinRoom(normalizedName, createResult.roomId)
    } catch {
      resetRoomState()
      setAppState(APP_STATES.SERVER_ERROR)
    }
  }

  async function handleJoinRoom(name) {
    if (isUnsupported) {
      enterUnsupportedState()
      return
    }

    const normalizedName = name.trim()
    prepareJoining()

    try {
      await joinRoom(normalizedName, roomId)
    } catch {
      resetRoomState()
      setAppState(APP_STATES.SERVER_ERROR)
    }
  }

  function prepareJoining() {
    isLeavingRef.current = false
    setAppState(APP_STATES.JOINING)
    setParticipants([])
    setMessages([])
  }

  async function joinRoom(normalizedName, nextRoomId) {
    const joinResult = await socketClient.joinRoom({
      roomId: nextRoomId,
      name: normalizedName,
      media,
    })

    if (!joinResult?.ok) {
      if (joinResult?.code === 'ROOM_FULL') {
        resetRoomState()
        setAppState(APP_STATES.FULL_ROOM)
        return
      }

      throw new Error(joinResult?.message || 'Room join failed')
    }

    selfIdRef.current = joinResult.selfId
    setRoomId(nextRoomId)
    setParticipants(markSelfParticipant(joinResult.room.participants, joinResult.selfId))
    setMessages(joinResult.room.messages)
    setAppState(APP_STATES.ROOM)
  }

  async function handleLeaveRoom() {
    isLeavingRef.current = true
    if (socketClient.connected) {
      try {
        await socketClient.leaveRoom()
      } catch {
        socketClient.disconnect()
      }
    }

    resetRoomState()
    setAppState(APP_STATES.START)
  }

  function handleToggleAudio() {
    setMedia((current) => {
      const next = { ...current, audioEnabled: !current.audioEnabled }
      updateSelfMedia(next)
      socketClient.updateMedia(next)
      return next
    })
  }

  function handleToggleVideo() {
    setMedia((current) => {
      const next = { ...current, videoEnabled: !current.videoEnabled }
      updateSelfMedia(next)
      socketClient.updateMedia(next)
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

  async function handleSendMessage(text) {
    const trimmedText = text.trim()

    if (!trimmedText) {
      return
    }

    try {
      await socketClient.sendChatMessage(trimmedText)
    } catch {
      setAppState(APP_STATES.SERVER_ERROR)
    }
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

function markSelfParticipant(participants, selfId) {
  return participants.map((participant) => ({
    ...participant,
    isSelf: participant.id === selfId,
  }))
}

export default App
