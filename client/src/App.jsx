import { useCallback, useEffect, useRef, useState } from 'react'
import './styles.css'
import { APP_STATES } from './appStates.js'
import { ChatPanel } from './components/ChatPanel.jsx'
import { NameGate } from './components/NameGate.jsx'
import { ParticipantsList } from './components/ParticipantsList.jsx'
import { RoomView } from './components/RoomView.jsx'
import { Toolbar } from './components/Toolbar.jsx'
import { VideoTile } from './components/VideoTile.jsx'
import { useLocalMedia } from './hooks/useLocalMedia.js'
import { socketClient } from './socketClient.js'
import { createPeerManager } from './webrtc/peerManager.js'

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
  const [copyStatus, setCopyStatus] = useState('idle')
  const localMedia = useLocalMedia()
  const { stopMedia } = localMedia
  const isLeavingRef = useRef(false)
  const peerManagerRef = useRef(null)
  const remoteStreamsRef = useRef(new Map())
  const selfIdRef = useRef('')
  const appStateRef = useRef(appState)

  const resetRoomState = useCallback(() => {
    peerManagerRef.current?.closeAll()
    peerManagerRef.current = null
    remoteStreamsRef.current.clear()
    selfIdRef.current = ''
    setParticipants([])
    setMessages([])
    setCopyStatus('idle')
    stopMedia()
  }, [stopMedia])

  useEffect(() => {
    appStateRef.current = appState
  }, [appState])

  useEffect(() => {
    peerManagerRef.current?.setLocalStream(localMedia.stream)
  }, [localMedia.stream])

  useEffect(() => {
    const unsubscribeRoom = socketClient.subscribeRoomEvents({
      'room:participant-joined': ({ participant } = {}) => {
        if (!participant?.id || participant.id === selfIdRef.current) {
          return
        }

        setParticipants((current) =>
          markSelfParticipant(upsertParticipant(current, participant), selfIdRef.current),
        )
        peerManagerRef.current?.createOfferForParticipant(participant.id).catch(() => {})
      },
      'room:participant-left': ({ participantId } = {}) => {
        if (!participantId) {
          return
        }

        peerManagerRef.current?.closePeer(participantId)
        remoteStreamsRef.current.delete(participantId)
        setParticipants((current) =>
          current.filter((participant) => participant.id !== participantId),
        )
      },
      'room:participants': ({ participants: nextParticipants = [] } = {}) => {
        setParticipants((current) =>
          markSelfParticipant(
            mergeParticipantStreams(nextParticipants, current, remoteStreamsRef.current),
            selfIdRef.current,
          ),
        )
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
    const unsubscribeWebRtc = socketClient.subscribeWebRtcEvents({
      'webrtc:offer': (payload) => {
        peerManagerRef.current?.handleOffer(payload).catch(() => {})
      },
      'webrtc:answer': (payload) => {
        peerManagerRef.current?.handleAnswer(payload).catch(() => {})
      },
      'webrtc:ice-candidate': (payload) => {
        peerManagerRef.current?.handleIceCandidate(payload).catch(() => {})
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
      unsubscribeWebRtc()
      unsubscribeDisconnect()
      unsubscribeConnectError()
      socketClient.disconnect()
    }
  }, [resetRoomState])

  function enterUnsupportedState() {
    setAppState(APP_STATES.UNSUPPORTED)
  }

  async function handleCreateRoom(name) {
    if (!localMedia.isSupported) {
      enterUnsupportedState()
      return
    }

    const normalizedName = name.trim()
    prepareJoining()

    try {
      const nextMedia = await localMedia.startMedia()
      const createResult = await socketClient.createRoom()

      if (!createResult?.ok) {
        throw new Error(createResult?.message || 'Room creation failed')
      }

      await joinRoom(normalizedName, createResult.roomId, nextMedia)
    } catch {
      resetRoomState()
      setAppState(APP_STATES.SERVER_ERROR)
    }
  }

  async function handleJoinRoom(name) {
    if (!localMedia.isSupported) {
      enterUnsupportedState()
      return
    }

    const normalizedName = name.trim()
    prepareJoining()

    try {
      const nextMedia = await localMedia.startMedia()
      await joinRoom(normalizedName, roomId, nextMedia)
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

  async function joinRoom(normalizedName, nextRoomId, nextMedia) {
    peerManagerRef.current?.closeAll()
    remoteStreamsRef.current.clear()
    peerManagerRef.current = createPeerManager({
      localStream: localMedia.getCurrentStream(),
      onIceStateChange: handlePeerIceState,
      onRemoteStream: handleRemoteStream,
      socketClient,
    })

    const joinResult = await socketClient.joinRoom({
      roomId: nextRoomId,
      name: normalizedName,
      media: nextMedia,
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
    setRoomRoute(nextRoomId)
    setParticipants(
      markSelfParticipant(
        mergeParticipantStreams(joinResult.room.participants, [], remoteStreamsRef.current),
        joinResult.selfId,
      ),
    )
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
    setStartRoute()
    setRoomId('')
    setAppState(APP_STATES.START)
  }

  function handleToggleAudio() {
    const nextMedia = localMedia.toggleAudio()
    updateSelfMedia(nextMedia)
    socketClient.updateMedia(nextMedia)
  }

  async function handleToggleVideo() {
    const nextMedia = await localMedia.toggleVideo()
    peerManagerRef.current?.setLocalStream(localMedia.getCurrentStream())
    updateSelfMedia(nextMedia)
    socketClient.updateMedia(nextMedia)
  }

  async function handleCopyRoomLink() {
    try {
      await copyText(window.location.href)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
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

  function handlePeerIceState(participantId, state) {
    if (state !== 'failed') {
      return
    }

    setParticipants((current) =>
      current.map((participant) =>
        participant.id === participantId ? { ...participant, connectionState: state } : participant,
      ),
    )
  }

  function handleRemoteStream(participantId, stream) {
    remoteStreamsRef.current.set(participantId, stream)
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === participantId ? { ...participant, stream } : participant,
      ),
    )
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
              <VideoTile
                key={participant.id}
                participant={participant}
                stream={participant.isSelf ? localMedia.stream : participant.stream}
              />
            ))}
          </div>
        }
        toolbar={
          <Toolbar
            audioEnabled={localMedia.media.audioEnabled}
            videoEnabled={localMedia.media.videoEnabled}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            onCopyLink={handleCopyRoomLink}
            onLeave={handleLeaveRoom}
            copyStatus={copyStatus}
          />
        }
        mediaStatus={localMedia.error}
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

function setRoomRoute(roomId) {
  const nextPath = `/room/${encodeURIComponent(roomId)}`

  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, '', nextPath)
  }
}

function setStartRoute() {
  if (window.location.pathname !== '/') {
    window.history.pushState({}, '', '/')
  }
}

async function copyText(text) {
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.top = '-1000px'
  textArea.style.left = '-1000px'
  document.body.append(textArea)
  textArea.select()

  try {
    const copied = document.execCommand('copy')
    if (!copied) {
      throw new Error('Copy command failed')
    }
  } finally {
    textArea.remove()
  }
}

function upsertParticipant(participants, nextParticipant) {
  const hasParticipant = participants.some((participant) => participant.id === nextParticipant.id)

  if (hasParticipant) {
    return participants.map((participant) =>
      participant.id === nextParticipant.id ? { ...participant, ...nextParticipant } : participant,
    )
  }

  return [...participants, nextParticipant]
}

function mergeParticipantStreams(nextParticipants, currentParticipants, remoteStreams = new Map()) {
  return nextParticipants.map((nextParticipant) => {
    const currentParticipant = currentParticipants.find(
      (participant) => participant.id === nextParticipant.id,
    )
    const remoteStream = remoteStreams.get(nextParticipant.id)

    return remoteStream
      ? { ...nextParticipant, stream: remoteStream }
      : currentParticipant?.stream
      ? { ...nextParticipant, stream: currentParticipant.stream }
      : nextParticipant
  })
}

export default App
