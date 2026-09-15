import { expect, test } from '@playwright/test'

test('creates a room, uses its URL, and keeps chat history for late joiners', async ({ browser }) => {
  const host = await openParticipant(browser, '/')

  await enterName(host.page, 'Alice', 'Создать')
  const roomUrl = host.page.url()

  await host.page.getByTitle('Скопировать ссылку').click()
  await expect(host.page.getByRole('button', { name: 'copied' })).toBeVisible()

  await sendChatMessage(host.page, 'Привет из истории')

  const guest = await openParticipant(browser, roomUrl)
  await enterName(guest.page, 'Bob', 'Войти')

  await expectParticipant(host.page, 'Bob')
  await expectParticipant(guest.page, 'Alice')
  await expect(guest.page.getByText('Привет из истории')).toBeVisible()

  await guest.context.close()
  await host.context.close()
})

test('shows full-room state for the fifth participant', async ({ browser }) => {
  const participants = []
  const host = await openParticipant(browser, '/')
  participants.push(host)

  await enterName(host.page, 'Alice', 'Создать')
  const roomUrl = host.page.url()

  for (const name of ['Bob', 'Cara', 'Dan']) {
    const participant = await openParticipant(browser, roomUrl)
    participants.push(participant)
    await enterName(participant.page, name, 'Войти')
  }

  const fifth = await openParticipant(browser, roomUrl)
  participants.push(fifth)
  await fifth.page.getByRole('textbox', { name: 'Имя' }).fill('Evan')
  await fifth.page.getByRole('button', { name: 'Войти' }).click()

  await expect(fifth.page.getByRole('heading', { name: 'Комната заполнена' })).toBeVisible()

  await Promise.all(participants.map(({ context }) => context.close()))
})

test('updates microphone and camera controls with fake media devices', async ({ browser }) => {
  const participant = await openParticipant(browser, '/')

  await enterName(participant.page, 'Alice', 'Создать')

  await expect(participant.page.getByRole('button', { name: 'mic' })).toBeVisible()
  await expect(participant.page.getByRole('button', { name: 'cam' })).toBeVisible()
  await expect(participant.page.getByLabel('Видео: Alice')).toBeVisible()

  await participant.page.getByTitle('Выключить микрофон').click()
  await expect(participant.page.getByRole('button', { name: 'mute' })).toBeVisible()
  await expect(participant.page.getByLabel('Микрофон выключен')).toBeVisible()

  await participant.page.getByTitle('Выключить камеру').click()
  await expect(participant.page.getByRole('button', { name: 'cam off' })).toBeVisible()
  await expect(participant.page.getByLabel('Камера выключена: Alice')).toBeVisible()

  await participant.context.close()
})

async function openParticipant(browser, url) {
  const context = await browser.newContext({
    permissions: ['camera', 'microphone', 'clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()

  await page.goto(url)

  return { context, page }
}

async function enterName(page, name, buttonName) {
  await page.getByRole('textbox', { name: 'Имя' }).fill(name)
  await page.getByRole('button', { name: buttonName }).click()
  await expect(page.getByRole('navigation', { name: 'Управление комнатой' })).toBeVisible()
  await expect(page).toHaveURL(/\/room\/[A-Za-z0-9_-]{6,64}$/)
}

async function sendChatMessage(page, text) {
  await page.getByPlaceholder('Сообщение').fill(text)
  await page.getByRole('button', { name: 'Отправить' }).click()
  await expect(page.getByText(text)).toBeVisible()
}

async function expectParticipant(page, name) {
  await expect(
    page.getByRole('listitem').filter({ hasText: new RegExp(`^${name}`) }),
  ).toBeVisible()
}
