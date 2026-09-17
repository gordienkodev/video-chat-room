# video-chat-room

Видеочат-комната на React, Node.js, Socket.io и WebRTC. Комнаты, участники и история чата хранятся только в памяти сервера.

Видео-демо https://youtu.be/iv9k69DU2zU

## Запуск в dev-режиме

Требования: Node.js и npm.

1. Установить зависимости:

```bash
npm install --prefix client
npm install --prefix server
```

2. Запустить signaling/chat server:

```bash
npm run dev --prefix server
```

По умолчанию сервер слушает `http://localhost:3002`.

3. В отдельном терминале запустить клиент:

```bash
npm run dev --prefix client
```

По умолчанию Vite открывает приложение на `http://localhost:5173`. Dev proxy в `client/vite.config.js` проксирует `/socket.io` и `/health` на backend `http://localhost:3002`.

## Проверки

Backend:

```bash
npm test --prefix server
```

Frontend unit tests:

```bash
npm test --prefix client
```

Frontend lint:

```bash
npm run lint --prefix client
```

Frontend build:

```bash
npm run build --prefix client
```

E2E smoke tests:

```bash
npm run test:e2e --prefix client
```

## Environment variables

Не храните реальные секреты и локальные настройки в репозитории. `.env` игнорируется git и не должен редактироваться в рамках задач; пример переменных находится в `.env.example`.

- `PORT`: порт backend-сервера. По умолчанию `3002`.
- `VITE_SIGNALING_URL`: URL signaling server для клиента. В dev-режиме можно не задавать, тогда используется `/` и Vite proxy.

## HTTPS, localhost и WebRTC

`getUserMedia` и WebRTC требуют secure context: `https://` или `localhost`. Для локальной разработки используйте `http://localhost:5173`; для доступа с другого устройства или production нужен HTTPS.

Приложение использует публичный Google STUN для ICE discovery. TURN-сервер не настроен.

## Ограничения текущей версии

- Нет TURN: у пользователей за строгим NAT часть P2P media-соединений может не установиться.
- Нет БД: комнаты, участники и сообщения живут только в памяти процесса Node.js.
- Нет persistent storage на клиенте: имя и состояние не сохраняются после refresh или нового входа.
- Нет auth: доступ к комнате определяется ссылкой/`roomId`; роли и права создателя отсутствуют.
- Нет auto-reconnect: после обрыва соединения пользователь возвращается только повторным входом.
- Лимит комнаты: максимум 4 участника.
