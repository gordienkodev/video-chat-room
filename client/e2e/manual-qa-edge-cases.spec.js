import { expect, test } from '@playwright/test'

test('allows joining when camera and microphone permissions are denied', async ({ browser }) => {
  const participant = await openParticipant(browser, '/', denyMediaAccess)

  await enterName(participant.page, 'NoMedia', 'Создать')

  await expect(participant.page.getByRole('status')).toContainText(
    'Не удалось получить доступ к камере или микрофону',
  )
  await expect(participant.page.getByLabel('Камера выключена: NoMedia')).toBeVisible()
  await expect(participant.page.getByLabel('Микрофон выключен')).toBeVisible()

  await participant.context.close()
})

test('allows joining when camera and microphone devices are absent', async ({ browser }) => {
  const participant = await openParticipant(browser, '/', simulateMissingDevices)

  await enterName(participant.page, 'NoDevices', 'Создать')

  await expect(participant.page.getByRole('status')).toContainText(
    'Не удалось получить доступ к камере или микрофону',
  )
  await expect(participant.page.getByLabel('Камера выключена: NoDevices')).toBeVisible()

  await participant.context.close()
})

test('handles refresh, multiple tabs, and tab close participant cleanup', async ({ browser }) => {
  const host = await openParticipant(browser, '/')

  await enterName(host.page, 'Alice', 'Создать')
  const roomUrl = host.page.url()

  const bob = await openParticipant(browser, roomUrl)
  await enterName(bob.page, 'Bob', 'Войти')
  await expectParticipant(host.page, 'Bob')

  await bob.page.reload()
  await expect(bob.page.getByRole('heading', { name: 'Введите имя для входа' })).toBeVisible()
  await expectNoParticipant(host.page, 'Bob')

  await enterName(bob.page, 'Bob', 'Войти')
  await expectParticipant(host.page, 'Bob')

  const cara = await openParticipant(browser, roomUrl)
  await enterName(cara.page, 'Cara', 'Войти')
  await expectParticipant(host.page, 'Cara')

  await cara.context.close()
  await expectNoParticipant(host.page, 'Cara')

  await bob.context.close()
  await host.context.close()
})

test('shows server error when signaling server is unavailable', async ({ browser }) => {
  const participant = await openParticipant(browser, '/', blockSocketIo)

  await participant.page.getByRole('textbox', { name: 'Имя' }).fill('Alice')
  await participant.page.getByRole('button', { name: 'Создать' }).click()

  await expect(participant.page.getByRole('heading', { name: 'Сервер недоступен' })).toBeVisible({
    timeout: 10_000,
  })

  await participant.context.close()
})

async function openParticipant(browser, url, initScript, prepareContext) {
  const context = await browser.newContext({
    permissions: ['camera', 'microphone', 'clipboard-read', 'clipboard-write'],
  })

  if (initScript) {
    await context.addInitScript(initScript)
  }

  if (prepareContext) {
    await prepareContext(context)
  }

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

async function expectParticipant(page, name) {
  await expect(
    page.getByRole('listitem').filter({ hasText: new RegExp(`^${name}`) }),
  ).toBeVisible()
}

async function expectNoParticipant(page, name) {
  await expect(
    page.getByRole('listitem').filter({ hasText: new RegExp(`^${name}`) }),
  ).toHaveCount(0)
}

function denyMediaAccess() {
  navigator.mediaDevices.getUserMedia = async () => {
    throw new DOMException('Permission denied', 'NotAllowedError')
  }
}

function simulateMissingDevices() {
  navigator.mediaDevices.getUserMedia = async () => {
    throw new DOMException('Requested device not found', 'NotFoundError')
  }
}

function blockSocketIo() {
  const NativeWebSocket = window.WebSocket
  const nativeFetch = window.fetch.bind(window)
  const nativeOpen = window.XMLHttpRequest.prototype.open
  const nativeSend = window.XMLHttpRequest.prototype.send

  window.WebSocket = function BlockedWebSocket(url, protocols) {
    if (String(url).includes('/socket.io')) {
      throw new Error('Socket.io unavailable')
    }

    return new NativeWebSocket(url, protocols)
  }
  window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING
  window.WebSocket.OPEN = NativeWebSocket.OPEN
  window.WebSocket.CLOSING = NativeWebSocket.CLOSING
  window.WebSocket.CLOSED = NativeWebSocket.CLOSED

  window.fetch = async (input, init) => {
    if (String(input).includes('/socket.io')) {
      throw new TypeError('Socket.io unavailable')
    }

    return nativeFetch(input, init)
  }

  window.XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
    this.__blockSocketIo = String(url).includes('/socket.io')
    return nativeOpen.call(this, method, url, ...rest)
  }

  window.XMLHttpRequest.prototype.send = function send(...args) {
    if (this.__blockSocketIo) {
      throw new Error('Socket.io unavailable')
    }

    return nativeSend.apply(this, args)
  }
}
