import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChatPanel } from './ChatPanel.jsx'

describe('ChatPanel', () => {
  it('sends only trimmed non-empty messages', async () => {
    const user = userEvent.setup()
    const onSendMessage = vi.fn()

    render(<ChatPanel messages={[]} onSendMessage={onSendMessage} />)

    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(onSendMessage).not.toHaveBeenCalled()

    await user.type(screen.getByPlaceholderText('Сообщение'), '  привет  ')
    await user.click(screen.getByRole('button', { name: 'Отправить' }))

    expect(onSendMessage).toHaveBeenCalledWith('привет')
    expect(screen.getByPlaceholderText('Сообщение')).toHaveValue('')
  })

  it('renders html-like message text as text content', () => {
    const messageText = '<img src=x onerror=alert(1)>'

    render(
      <ChatPanel
        messages={[
          {
            id: 'message-1',
            type: 'user',
            senderName: '<script>bad()</script>',
            text: messageText,
            createdAt: Date.UTC(2026, 8, 15, 9, 30),
          },
        ]}
        onSendMessage={() => {}}
      />,
    )

    expect(screen.getByText(messageText)).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText('<script>bad()</script>')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })
})

