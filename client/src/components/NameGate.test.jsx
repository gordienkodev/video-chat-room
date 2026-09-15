import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NameGate } from './NameGate.jsx'

describe('NameGate', () => {
  it('shows validation errors and does not submit invalid names', async () => {
    const user = userEvent.setup()
    const onCreateRoom = vi.fn()

    render(<NameGate mode="create" onCreateRoom={onCreateRoom} onJoinRoom={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Создать' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Введите имя.')
    expect(onCreateRoom).not.toHaveBeenCalled()
  })

  it('submits join mode names to join handler', async () => {
    const user = userEvent.setup()
    const onJoinRoom = vi.fn()

    render(
      <NameGate
        mode="join"
        roomId="room-123"
        onCreateRoom={() => {}}
        onJoinRoom={onJoinRoom}
      />,
    )

    await user.type(screen.getByLabelText('Имя'), 'Ира')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(onJoinRoom).toHaveBeenCalledWith('Ира')
  })
})

