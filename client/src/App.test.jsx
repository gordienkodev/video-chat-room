import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

const localMediaMock = vi.hoisted(() => ({
  error: '',
  getCurrentStream: vi.fn(() => null),
  isSupported: true,
  media: { audioEnabled: false, videoEnabled: false },
  startMedia: vi.fn(),
  stopMedia: vi.fn(),
  stream: null,
  toggleAudio: vi.fn(),
  toggleVideo: vi.fn(),
}))

const socketClientMock = vi.hoisted(() => ({
  connected: false,
  createRoom: vi.fn(),
  disconnect: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  onConnectError: vi.fn(() => () => {}),
  onDisconnect: vi.fn(() => () => {}),
  sendChatMessage: vi.fn(),
  subscribeChatEvents: vi.fn(() => () => {}),
  subscribeMediaEvents: vi.fn(() => () => {}),
  subscribeRoomEvents: vi.fn(() => () => {}),
  subscribeWebRtcEvents: vi.fn(() => () => {}),
  updateMedia: vi.fn(),
}))

vi.mock('./hooks/useLocalMedia.js', () => ({
  useLocalMedia: () => localMediaMock,
}))

vi.mock('./socketClient.js', () => ({
  socketClient: socketClientMock,
}))

vi.mock('./webrtc/peerManager.js', () => ({
  createPeerManager: vi.fn(() => ({
    closeAll: vi.fn(),
    closePeer: vi.fn(),
    createOfferForParticipant: vi.fn(),
    handleAnswer: vi.fn(),
    handleIceCandidate: vi.fn(),
    handleOffer: vi.fn(),
    setLocalStream: vi.fn(),
  })),
}))

describe('App state transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localMediaMock.error = ''
    localMediaMock.getCurrentStream.mockReturnValue(null)
    localMediaMock.isSupported = true
    localMediaMock.media = { audioEnabled: false, videoEnabled: false }
    localMediaMock.startMedia.mockResolvedValue({ audioEnabled: false, videoEnabled: false })
    localMediaMock.stream = null
    socketClientMock.connected = false
    socketClientMock.createRoom.mockResolvedValue({ ok: true, roomId: 'room123' })
    socketClientMock.joinRoom.mockResolvedValue({
      ok: true,
      selfId: 'self-1',
      room: {
        messages: [],
        participants: [
          {
            id: 'self-1',
            name: 'Тест',
            media: { audioEnabled: false, videoEnabled: false },
          },
        ],
      },
    })
    window.history.pushState({}, '', '/')
  })

  it('moves from start screen to room after room creation', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Создать комнату' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Имя'), 'Тест')
    await user.click(screen.getByRole('button', { name: 'Создать' }))

    expect(await screen.findByLabelText('Видео участников')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/room/room123')
  })

  it('shows full-room state when join is rejected with ROOM_FULL', async () => {
    const user = userEvent.setup()
    socketClientMock.joinRoom.mockResolvedValue({ ok: false, code: 'ROOM_FULL' })

    render(<App />)

    await user.type(screen.getByLabelText('Имя'), 'Тест')
    await user.click(screen.getByRole('button', { name: 'Создать' }))

    expect(await screen.findByRole('heading', { name: 'Комната заполнена' })).toBeInTheDocument()
    expect(localMediaMock.stopMedia).toHaveBeenCalled()
  })

  it('shows server-error state when create room fails', async () => {
    const user = userEvent.setup()
    socketClientMock.createRoom.mockRejectedValue(new Error('offline'))

    render(<App />)

    await user.type(screen.getByLabelText('Имя'), 'Тест')
    await user.click(screen.getByRole('button', { name: 'Создать' }))

    expect(await screen.findByRole('heading', { name: 'Сервер недоступен' })).toBeInTheDocument()
  })

  it('shows unsupported state before trying to join without WebRTC support', async () => {
    const user = userEvent.setup()
    localMediaMock.isSupported = false

    render(<App />)

    await user.type(screen.getByLabelText('Имя'), 'Тест')
    await user.click(screen.getByRole('button', { name: 'Создать' }))

    expect(
      await screen.findByRole('heading', { name: 'WebRTC не поддерживается' }),
    ).toBeInTheDocument()
    expect(socketClientMock.createRoom).not.toHaveBeenCalled()
  })

  it('sends media updates when toolbar toggles change local media state', async () => {
    const user = userEvent.setup()
    localMediaMock.media = { audioEnabled: true, videoEnabled: true }
    localMediaMock.toggleAudio.mockReturnValue({ audioEnabled: false, videoEnabled: true })
    localMediaMock.toggleVideo.mockResolvedValue({ audioEnabled: false, videoEnabled: false })

    render(<App />)

    await user.type(screen.getByLabelText('Имя'), 'Тест')
    await user.click(screen.getByRole('button', { name: 'Создать' }))
    await screen.findByLabelText('Видео участников')

    await user.click(screen.getByTitle('Выключить микрофон'))
    expect(socketClientMock.updateMedia).toHaveBeenCalledWith({
      audioEnabled: false,
      videoEnabled: true,
    })

    await user.click(screen.getByTitle('Выключить камеру'))

    await waitFor(() => {
      expect(socketClientMock.updateMedia).toHaveBeenCalledWith({
        audioEnabled: false,
        videoEnabled: false,
      })
    })
  })
})

