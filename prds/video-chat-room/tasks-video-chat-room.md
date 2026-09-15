# Implementation Plan

Основано на:

- PRD: `prds/prd-video-chat-room.md` (путь из запроса `prds/video-chat-room/prd-video-chat-room.md` в проекте не найден)
- TDD: `prds/video-chat-room/design-video-chat-room.md`
- Правило: `prds/prd-tasks.mdc`

- [x] 1. Подготовить структуру backend-модулей
  - Создать точки расширения для HTTP server, room store, socket handlers и validation без бизнес-логики сверх каркаса.
  - Зафиксировать CommonJS/ESM-подход в соответствии с текущим `server/package.json`.
  - Зависимости: нет; выполнять перед задачами 2-8.
  - _Requirements: F-02, F-03, F-04, F-05, F-12, F-16, F-18; Design: 4 Backend, 6 API / Contracts, 12 Deployment_

- [x] 2. Реализовать backend validation
  - Добавить нормализацию и проверку имени: trim, 1-30 символов, запрет спецсимволов.
  - Добавить проверку `roomId` по URL-safe regex и ограничение длины.
  - Добавить проверку chat message: trim, запрет пустых сообщений, разумный лимит длины.
  - Покрыть validation unit-тестами.
  - Зависимости: после 1; перед 3, 4, 6.
  - _Requirements: F-01, F-15, Must 24, Must 38, Must 39, Should 40; Design: 4 Backend, 8 Error Handling, 10 Security_

- [ ] 3. Реализовать in-memory room store
  - Добавить `Map<roomId, Room>` и модели `Room`, `Participant`, `ChatMessage`.
  - Реализовать создание/получение комнаты, добавление участника, удаление участника, удаление пустой комнаты.
  - Реализовать атомарную проверку лимита 4 участников внутри операции join.
  - Добавить хранение истории сообщений на время жизни комнаты.
  - Покрыть unit-тестами room lifecycle и лимит участников.
  - Зависимости: после 2; перед 4-7.
  - _Requirements: F-03, F-04, F-05, F-13, F-14, F-16, F-18, Must 9, Must 30; Design: 5 Data Model, 8 Error Handling, 9 Performance_

- [ ] 4. Реализовать HTTP entrypoint сервера
  - Создать `server/index.js` с Express, HTTP server и Socket.io.
  - Добавить `GET /health`.
  - Настроить CORS для dev origin и базовую конфигурацию production-static без чтения `.env`.
  - Добавить npm scripts для запуска сервера, если их нет.
  - Зависимости: после 1; перед 5-8.
  - _Requirements: Must 35; Design: 4 Backend, 6 HTTP, 10 Security, 12 Deployment_

- [ ] 5. Реализовать Socket.io room lifecycle handlers
  - Добавить `room:create` с генерацией уникального `roomId`.
  - Добавить `room:join` с ack-ответами success / `ROOM_FULL`.
  - Добавить `room:leave` и `disconnect` с одинаковым удалением участника.
  - Рассылать `room:participant-joined`, `room:participant-left`, `room:participants`.
  - Добавлять системные сообщения о входе/выходе.
  - Зависимости: после 3 и 4; перед 6, 7, 16.
  - _Requirements: F-02, F-03, F-04, F-05, F-15, F-16, F-17, F-18, Must 8, Must 27, Must 28, Must 31, Must 32; Design: 6 Socket.io Contracts, 7 Data & Control Flows, 8 Error Handling_

- [ ] 6. Реализовать Socket.io chat handlers
  - Добавить `chat:send` с серверной валидацией текста.
  - Рассылать `chat:message` всем участникам комнаты.
  - Возвращать историю сообщений в `room:join` snapshot.
  - Убедиться, что сервер не формирует HTML из пользовательского ввода.
  - Зависимости: после 3 и 5; перед 13, 16.
  - _Requirements: F-12, F-13, F-14, F-15, Must 21, Must 22, Must 23, Must 24, Must 39; Design: 6 API / Contracts, 8 Error Handling, 10 Security_

- [ ] 7. Реализовать Socket.io WebRTC signaling relay
  - Добавить ретрансляцию `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate` только адресату в той же комнате.
  - Добавлять `from` на серверных signaling events.
  - Обрабатывать невалидные payloads без падения сервера.
  - Покрыть integration-тестами адресную доставку и запрет доставки вне комнаты.
  - Зависимости: после 5; перед 11, 16.
  - _Requirements: F-06, Must 10, Should 34; Design: 6 API / Contracts, 7 Data & Control Flows, 8 Error Handling_

- [ ] 8. Настроить server integration tests
  - Добавить тестовый запуск Socket.io server и несколько Socket.io clients.
  - Проверить join/create, отклонение 5-го участника, гонку за последний слот.
  - Проверить chat broadcast/history, disconnect cleanup, удаление пустой комнаты.
  - Проверить signaling relay между участниками.
  - Зависимости: после 5-7.
  - _Requirements: F-03, F-05, F-12, F-14, F-16, F-18; Design: 11 Testing Strategy_

- [ ] 9. Подготовить структуру frontend-приложения
  - Убрать starter UI из `App.jsx` и выделить состояния: старт, ввод имени по ссылке, joining, room, full-room, server-error, unsupported.
  - Добавить базовые компоненты `NameGate`, `RoomView`, `VideoTile`, `ChatPanel`, `ParticipantsList`, `Toolbar`.
  - Не использовать localStorage/sessionStorage для имени или состояния.
  - Зависимости: после 1 можно параллельно с backend; перед 10-15.
  - _Requirements: F-01, F-02, F-03, Must 36, Non-Goals client storage; Design: 4 Frontend, 8 Error Handling_

- [ ] 10. Реализовать client socket layer
  - Добавить `socket.io-client` dependency.
  - Создать `socketClient` с подключением к signaling server и контролируемым reconnect policy без автоматического возврата в комнату.
  - Реализовать подписки/отписки на room, chat, media и webrtc events.
  - Добавить обработку ошибки недоступного сервера и retry.
  - Зависимости: после 4 и 9; перед 12-15.
  - _Requirements: Must 31, Must 35; Design: 4 Frontend, 6 API / Contracts, 8 Error Handling, 13 Risks_

- [ ] 11. Реализовать local media hook
  - Проверять поддержку `navigator.mediaDevices` и `RTCPeerConnection`.
  - Запрашивать audio/video при входе, учитывая autoplay gesture через действие пользователя.
  - Разрешить вход при отказе permissions или отсутствии устройств с выключенными media flags.
  - Реализовать выключение микрофона через `track.enabled`.
  - Реализовать выключение камеры через `track.stop()` и повторное получение video track при включении.
  - Зависимости: после 9; перед 12, 14, 15.
  - _Requirements: F-06, F-09, F-10, Must 13, Must 14, Must 19, Must 20, Must 33, Must 36, Must 37; Design: 4 Frontend, 8 Error Handling, 13 Risks_

- [ ] 12. Реализовать WebRTC peer manager
  - Создавать один `RTCPeerConnection` на каждого удалённого участника.
  - Использовать Google STUN.
  - Добавлять local tracks и обрабатывать remote tracks.
  - Реализовать offer/answer flow по правилу из TDD: существующие участники создают offer новому.
  - Обрабатывать ICE candidates, ICE failed state и cleanup при выходе участника.
  - Зависимости: после 7, 10, 11; перед 15, 16.
  - _Requirements: F-06, F-07, Should 34, Must 10; Design: 3 Proposed Architecture, 4 Frontend, 7 Data & Control Flows, 9 Performance_

- [ ] 13. Реализовать стартовый экран и вход по ссылке
  - Добавить русскоязычную форму имени с клиентской валидацией.
  - Реализовать создание комнаты через `room:create` и переход на `/room/:roomId`.
  - Реализовать вход по существующему или новому `roomId` из URL.
  - Отобразить ошибки имени, заполненной комнаты, сервера и неподдерживаемого WebRTC.
  - Зависимости: после 9-11; перед 15, 17.
  - _Requirements: F-01, F-02, F-03, F-04, F-05, Must 8, Must 35, Must 36; Design: 4 Frontend, 7 Data & Control Flows, 8 Error Handling_

- [ ] 14. Реализовать UI управления микрофоном, камерой и выходом
  - Добавить toolbar с кнопками микрофона, камеры, копирования ссылки и выхода.
  - Отправлять `media:update` при изменении local media state.
  - Обновлять индикаторы медиа у себя и у удалённых участников.
  - При выходе закрывать tracks, peer connections, socket room state и возвращать пользователя к стартовому состоянию.
  - Зависимости: после 10 и 11; перед 15, 17.
  - _Requirements: F-09, F-10, F-11, F-17, Must 15, Must 16, Must 18, Must 19, Must 27; Design: 4 Frontend, 6 API / Contracts, 8 Error Handling_

- [ ] 15. Реализовать экран комнаты и видеосетку
  - Добавить desktop-first layout от 1024px: video grid, self-view, chat panel, participants list.
  - Реализовать сетку 1-4 плитки, включая заглушку при выключенной/отсутствующей камере.
  - Показывать имя участника оверлеем и иконку выключенного микрофона.
  - Не использовать `dangerouslySetInnerHTML`; имена выводить как React text nodes.
  - Зависимости: после 12-14; перед 17.
  - _Requirements: F-06, F-07, F-08, F-09, F-10, F-16, Must 11, Must 12, Must 16, Must 18, Must 39; Design: 4 Frontend, 8 Error Handling, 9 Performance, 10 Security_

- [ ] 16. Реализовать chat panel и participants list
  - Отправлять только непустые сообщения.
  - Отображать user/system messages, имя отправителя и локальное время `HH:MM`.
  - Автоматически прокручивать чат к последнему сообщению.
  - Обновлять список участников в реальном времени.
  - Гарантировать XSS-safe rendering через текстовые узлы React.
  - Зависимости: после 6, 10, 15; перед 17.
  - _Requirements: F-12, F-13, F-14, F-15, F-16, Must 21, Must 22, Must 23, Must 24, Must 26, Must 39; Design: 4 Frontend, 6 API / Contracts, 8 Error Handling, 10 Security_

- [ ] 17. Настроить frontend routing и dev proxy
  - Обеспечить работу прямого открытия `/room/:roomId` в Vite dev server.
  - Настроить proxy `/socket.io` и `/health` на backend или документированную переменную `VITE_SIGNALING_URL` в `.env.example`.
  - Не читать и не изменять `.env`; новые настройки описывать только в `.env.example`.
  - Зависимости: после 4, 10, 13.
  - _Requirements: F-03, F-04, Must 35; Design: 10 Security, 12 Deployment_

- [ ] 18. Добавить frontend unit tests
  - Проверить валидацию имени и chat input.
  - Проверить state transitions стартового экрана, full-room, server-error, unsupported.
  - Проверить media toggle state с mock tracks.
  - Проверить безопасный рендер HTML/JS-подобного текста.
  - Зависимости: после 9, 11, 13, 14, 16.
  - _Requirements: F-01, F-09, F-10, F-12, Must 33, Must 36, Must 39; Design: 11 Testing Strategy_

- [ ] 19. Добавить WebRTC unit tests с mock RTCPeerConnection
  - Проверить создание peer connection на участника.
  - Проверить добавление local tracks и обработку remote tracks.
  - Проверить cleanup при `participant-left`.
  - Проверить обработку ICE failed без падения UI.
  - Зависимости: после 12.
  - _Requirements: F-06, F-07, Should 34; Design: 11 Testing Strategy, 13 Risks_

- [ ] 20. Добавить Playwright E2E smoke tests
  - Запускать client + server в тестовом окружении.
  - Проверить создание комнаты, копирование/использование URL, вход второго участника.
  - Проверить чат и историю для позднего входа.
  - Проверить full-room для 5-го участника.
  - Проверить mute/camera UI state с fake media devices.
  - Зависимости: после 8, 15, 16, 17.
  - _Requirements: F-02, F-03, F-04, F-05, F-06, F-09, F-10, F-12, F-14; Design: 11 Testing Strategy_

- [ ] 21. Провести manual QA по ключевым edge cases
  - Проверить Chrome, Firefox, Edge 100+ на localhost.
  - Проверить отказ в camera/mic permissions.
  - Проверить отсутствие камеры/микрофона.
  - Проверить закрытие вкладки, refresh, несколько вкладок.
  - Проверить состояние при недоступном signaling server.
  - Зависимости: после 20.
  - _Requirements: Must 28, Must 29, Must 33, Must 35, Must 36; Design: 8 Error Handling, 11 Testing Strategy_

- [ ] 22. Обновить документацию запуска и ограничений
  - Описать dev startup client/server.
  - Описать HTTPS/localhost requirement для WebRTC.
  - Описать отсутствие TURN, БД, auth, auto-reconnect и persistent storage.
  - Описать переменные в `.env.example`, если они добавлены на этапе реализации.
  - Зависимости: после 17; финализировать после 20.
  - _Requirements: Non-Goals, Must 35, Technical Considerations HTTPS/STUN; Design: 9 Performance, 10 Security, 12 Deployment, 13 Risks_

- [ ] 23. Финальная проверка соответствия PRD/TDD
  - Сверить все Must/Should требования PRD с реализованными задачами и тестами.
  - Проверить, что production-код не использует localStorage/sessionStorage для состояния.
  - Проверить, что `.env` не читался и не изменялся; новые данные находятся только в `.env.example`.
  - Проверить, что комнаты и история удаляются после выхода последнего участника.
  - Зависимости: после 18-22.
  - _Requirements: все Must/Should из PRD; Design: 8 Error Handling, 10 Security, 11 Testing Strategy, 12 Deployment_
