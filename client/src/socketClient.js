import { io } from 'socket.io-client'

const ACK_TIMEOUT_MS = 5000
const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || '/'

const ROOM_EVENTS = [
  'room:participant-joined',
  'room:participant-left',
  'room:participants',
]

const CHAT_EVENTS = ['chat:message']
const MEDIA_EVENTS = ['media:updated']
const WEBRTC_EVENTS = ['webrtc:offer', 'webrtc:answer', 'webrtc:ice-candidate']

function createSocketClient() {
  const socket = io(SIGNALING_URL, {
    autoConnect: false,
    reconnection: false,
    timeout: ACK_TIMEOUT_MS,
    transports: ['websocket', 'polling'],
  })

  function connect() {
    if (socket.connected) {
      return Promise.resolve(socket)
    }

    return new Promise((resolve, reject) => {
      function handleConnect() {
        cleanup()
        resolve(socket)
      }

      function handleError(error) {
        cleanup()
        reject(error)
      }

      function cleanup() {
        socket.off('connect', handleConnect)
        socket.off('connect_error', handleError)
      }

      socket.once('connect', handleConnect)
      socket.once('connect_error', handleError)
      socket.connect()
    })
  }

  async function emitWithAck(eventName, payload = {}) {
    await connect()

    return new Promise((resolve, reject) => {
      socket.timeout(ACK_TIMEOUT_MS).emit(eventName, payload, (error, response) => {
        if (error) {
          reject(error)
          return
        }

        resolve(response)
      })
    })
  }

  function on(eventName, handler) {
    socket.on(eventName, handler)

    return () => {
      socket.off(eventName, handler)
    }
  }

  function subscribe(events, handlers = {}) {
    const unsubscribers = events
      .filter((eventName) => typeof handlers[eventName] === 'function')
      .map((eventName) => on(eventName, handlers[eventName]))

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }

  return {
    get id() {
      return socket.id
    },

    get connected() {
      return socket.connected
    },

    connect,

    disconnect() {
      socket.disconnect()
    },

    createRoom() {
      return emitWithAck('room:create')
    },

    joinRoom({ roomId, name, media }) {
      return emitWithAck('room:join', { roomId, name, media })
    },

    leaveRoom() {
      return emitWithAck('room:leave')
    },

    sendChatMessage(text) {
      return emitWithAck('chat:send', { text })
    },

    updateMedia(media) {
      socket.emit('media:update', media)
    },

    sendOffer({ to, description }) {
      return emitWithAck('webrtc:offer', { to, description })
    },

    sendAnswer({ to, description }) {
      return emitWithAck('webrtc:answer', { to, description })
    },

    sendIceCandidate({ to, candidate }) {
      return emitWithAck('webrtc:ice-candidate', { to, candidate })
    },

    onDisconnect(handler) {
      return on('disconnect', handler)
    },

    onConnectError(handler) {
      return on('connect_error', handler)
    },

    subscribeRoomEvents(handlers) {
      return subscribe(ROOM_EVENTS, handlers)
    },

    subscribeChatEvents(handlers) {
      return subscribe(CHAT_EVENTS, handlers)
    },

    subscribeMediaEvents(handlers) {
      return subscribe(MEDIA_EVENTS, handlers)
    },

    subscribeWebRtcEvents(handlers) {
      return subscribe(WEBRTC_EVENTS, handlers)
    },
  }
}

const socketClient = createSocketClient()

export { createSocketClient, socketClient }
