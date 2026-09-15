"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRoomStore } = require("../src/rooms/roomStore");
const { registerSocketHandlers } = require("../src/socket/handlers");
const validators = require("../src/validation");

test("room:create returns a valid roomId and room:join adds a participant with lifecycle broadcasts", () => {
  const roomStore = createRoomStore({ now: () => 1000, createId: () => "message-1" });
  const io = createFakeIo();

  registerSocketHandlers({ io, roomStore, validators });

  const socket = io.connect("socket-1");
  let createAck;
  socket.trigger("room:create", {}, (ack) => {
    createAck = ack;
  });

  assert.equal(createAck.ok, true);
  assert.equal(validators.validateRoomId(createAck.roomId).ok, true);
  assert.deepEqual(roomStore.getRoom(createAck.roomId).participants, []);

  let joinAck;
  socket.trigger(
    "room:join",
    {
      roomId: createAck.roomId,
      name: " Алекс ",
      media: { audioEnabled: true, videoEnabled: false },
    },
    (ack) => {
      joinAck = ack;
    },
  );

  assert.equal(joinAck.ok, true);
  assert.equal(joinAck.selfId, "socket-1");
  assert.deepEqual(joinAck.room.participants, [
    {
      id: "socket-1",
      name: "Алекс",
      joinedAt: 1000,
      media: { audioEnabled: true, videoEnabled: false },
    },
  ]);
  assert.deepEqual(joinAck.room.messages, [
    {
      id: "message-1",
      type: "system",
      text: "Алекс вошёл в комнату",
      createdAt: 1000,
    },
  ]);
  assert.deepEqual(socket.received.map((event) => event.name), ["room:participants", "chat:message"]);
});

test("room:join rejects the fifth participant with ROOM_FULL", () => {
  const roomStore = createRoomStore();
  const io = createFakeIo();

  registerSocketHandlers({ io, roomStore, validators });

  for (let index = 1; index <= 4; index += 1) {
    const socket = io.connect(`socket-${index}`);
    let ack;

    socket.trigger(
      "room:join",
      {
        roomId: "room-full",
        name: `User ${index}`,
        media: { audioEnabled: true, videoEnabled: true },
      },
      (response) => {
        ack = response;
      },
    );

    assert.equal(ack.ok, true);
  }

  const rejectedSocket = io.connect("socket-5");
  let rejected;

  rejectedSocket.trigger(
    "room:join",
    {
      roomId: "room-full",
      name: "User 5",
      media: { audioEnabled: true, videoEnabled: true },
    },
    (response) => {
      rejected = response;
    },
  );

  assert.deepEqual(rejected, {
    ok: false,
    code: "ROOM_FULL",
    message: "Комната заполнена",
  });
  assert.equal(roomStore.getRoom("room-full").participants.length, 4);
});

test("room:join rejects malformed payloads without throwing", () => {
  const roomStore = createRoomStore();
  const io = createFakeIo();

  registerSocketHandlers({ io, roomStore, validators });

  const socket = io.connect("socket-1");
  let rejected;

  socket.trigger("room:join", null, (response) => {
    rejected = response;
  });

  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "INVALID_ROOM_ID");
});

test("room:leave and disconnect remove participants, broadcast updates, and delete empty rooms", () => {
  let messageId = 0;
  const roomStore = createRoomStore({
    now: () => 2000,
    createId: () => `message-${(messageId += 1)}`,
  });
  const io = createFakeIo();

  registerSocketHandlers({ io, roomStore, validators });

  const first = io.connect("socket-1");
  const second = io.connect("socket-2");

  join(first, "room-life", "Алекс");
  join(second, "room-life", "Мария");
  first.received = [];

  let leaveAck;
  second.trigger("room:leave", {}, (ack) => {
    leaveAck = ack;
  });

  assert.deepEqual(leaveAck, { ok: true, left: true });
  assert.deepEqual(
    first.received.map((event) => event.name),
    ["room:participant-left", "room:participants", "chat:message"],
  );
  assert.deepEqual(first.received[0].payload, {
    participantId: "socket-2",
    name: "Мария",
  });
  assert.deepEqual(
    roomStore.getRoom("room-life").participants.map((participant) => participant.id),
    ["socket-1"],
  );

  first.trigger("disconnect");

  assert.equal(roomStore.getRoom("room-life"), null);
});

test("chat:send validates, stores, broadcasts plain text, and returns history on join", () => {
  let messageId = 0;
  const roomStore = createRoomStore({
    now: () => 3000,
    createId: () => `message-${(messageId += 1)}`,
  });
  const io = createFakeIo();

  registerSocketHandlers({ io, roomStore, validators });

  const first = io.connect("socket-1");
  const second = io.connect("socket-2");

  join(first, "room-chat", "Алекс");
  join(second, "room-chat", "Мария");
  first.received = [];
  second.received = [];

  let sendAck;
  first.trigger("chat:send", { text: "  <b>Привет</b>  " }, (ack) => {
    sendAck = ack;
  });

  assert.equal(sendAck.ok, true);
  assert.deepEqual(sendAck.message, {
    id: "message-3",
    type: "user",
    senderId: "socket-1",
    senderName: "Алекс",
    text: "<b>Привет</b>",
    createdAt: 3000,
  });
  assert.deepEqual(first.received, [{ name: "chat:message", payload: sendAck.message }]);
  assert.deepEqual(second.received, [{ name: "chat:message", payload: sendAck.message }]);

  const late = io.connect("socket-3");
  const joinAck = join(late, "room-chat", "Ира");

  assert.equal(
    joinAck.room.messages.some(
      (message) => message.type === "user" && message.text === "<b>Привет</b>",
    ),
    true,
  );
});

test("chat:send rejects invalid text and sockets outside rooms without broadcasting", () => {
  const roomStore = createRoomStore();
  const io = createFakeIo();

  registerSocketHandlers({ io, roomStore, validators });

  const socket = io.connect("socket-1");
  let notInRoomAck;
  socket.trigger("chat:send", { text: "Привет" }, (ack) => {
    notInRoomAck = ack;
  });

  assert.deepEqual(notInRoomAck, {
    ok: false,
    code: "NOT_IN_ROOM",
    message: "Socket is not in a room",
  });

  join(socket, "room-chat", "Алекс");
  socket.received = [];

  let invalidAck;
  socket.trigger("chat:send", { text: "   " }, (ack) => {
    invalidAck = ack;
  });

  assert.equal(invalidAck.ok, false);
  assert.equal(invalidAck.code, "INVALID_CHAT_MESSAGE");
  assert.deepEqual(socket.received, []);
});

test("webrtc signaling relays only to a recipient in the same room and adds from", () => {
  const roomStore = createRoomStore();
  const io = createFakeIo();

  registerSocketHandlers({ io, roomStore, validators });

  const first = io.connect("socket-1");
  const second = io.connect("socket-2");
  const third = io.connect("socket-3");

  join(first, "room-call", "User 1");
  join(second, "room-call", "User 2");
  join(third, "other-room", "User 3");
  first.received = [];
  second.received = [];
  third.received = [];

  let offerAck;
  first.trigger(
    "webrtc:offer",
    {
      to: "socket-2",
      description: { type: "offer", sdp: "offer-sdp" },
    },
    (ack) => {
      offerAck = ack;
    },
  );

  assert.deepEqual(offerAck, { ok: true });
  assert.deepEqual(first.received, []);
  assert.deepEqual(second.received, [
    {
      name: "webrtc:offer",
      payload: {
        from: "socket-1",
        description: { type: "offer", sdp: "offer-sdp" },
      },
    },
  ]);
  assert.deepEqual(third.received, []);

  let answerAck;
  second.trigger(
    "webrtc:answer",
    {
      to: "socket-1",
      description: { type: "answer", sdp: "answer-sdp" },
    },
    (ack) => {
      answerAck = ack;
    },
  );

  assert.deepEqual(answerAck, { ok: true });
  assert.deepEqual(first.received, [
    {
      name: "webrtc:answer",
      payload: {
        from: "socket-2",
        description: { type: "answer", sdp: "answer-sdp" },
      },
    },
  ]);

  let iceAck;
  second.trigger(
    "webrtc:ice-candidate",
    {
      to: "socket-1",
      candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 },
    },
    (ack) => {
      iceAck = ack;
    },
  );

  assert.deepEqual(iceAck, { ok: true });
  assert.deepEqual(first.received[1], {
    name: "webrtc:ice-candidate",
    payload: {
      from: "socket-2",
      candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 },
    },
  });
});

test("webrtc signaling rejects invalid payloads and recipients outside the room without broadcasting", () => {
  const roomStore = createRoomStore();
  const io = createFakeIo();

  registerSocketHandlers({ io, roomStore, validators });

  const first = io.connect("socket-1");
  const second = io.connect("socket-2");
  const outsider = io.connect("socket-3");
  const notJoined = io.connect("socket-4");

  join(first, "room-call", "User 1");
  join(second, "room-call", "User 2");
  join(outsider, "other-room", "User 3");
  first.received = [];
  second.received = [];
  outsider.received = [];

  let invalidPayloadAck;
  first.trigger(
    "webrtc:offer",
    {
      to: "socket-2",
      description: null,
    },
    (ack) => {
      invalidPayloadAck = ack;
    },
  );

  assert.equal(invalidPayloadAck.ok, false);
  assert.equal(invalidPayloadAck.code, "INVALID_WEBRTC_PAYLOAD");
  assert.deepEqual(second.received, []);

  let outsiderAck;
  first.trigger(
    "webrtc:offer",
    {
      to: "socket-3",
      description: { type: "offer", sdp: "offer-sdp" },
    },
    (ack) => {
      outsiderAck = ack;
    },
  );

  assert.deepEqual(outsiderAck, {
    ok: false,
    code: "RECIPIENT_NOT_IN_ROOM",
    message: "Recipient is not in the same room",
  });
  assert.deepEqual(outsider.received, []);

  let notInRoomAck;
  notJoined.trigger(
    "webrtc:ice-candidate",
    {
      to: "socket-1",
      candidate: { candidate: "candidate:1" },
    },
    (ack) => {
      notInRoomAck = ack;
    },
  );

  assert.deepEqual(notInRoomAck, {
    ok: false,
    code: "NOT_IN_ROOM",
    message: "Socket is not in a room",
  });
  assert.deepEqual(first.received, []);
});

function join(socket, roomId, name) {
  let ack;

  socket.trigger(
    "room:join",
    {
      roomId,
      name,
      media: { audioEnabled: true, videoEnabled: true },
    },
    (response) => {
      ack = response;
    },
  );

  assert.equal(ack.ok, true);
  return ack;
}

function createFakeIo() {
  const sockets = new Map();
  const roomMembers = new Map();
  let connectionHandler;

  return {
    on(eventName, handler) {
      if (eventName === "connection") {
        connectionHandler = handler;
      }
    },
    to(roomId) {
      return {
        emit(eventName, payload) {
          emitToRoom(roomId, eventName, payload);
        },
      };
    },
    connect(socketId) {
      const socket = createFakeSocket(socketId, this);
      sockets.set(socketId, socket);
      connectionHandler(socket);
      return socket;
    },
  };

  function createFakeSocket(id, io) {
    const handlers = new Map();

    return {
      id,
      data: {},
      received: [],
      on(eventName, handler) {
        handlers.set(eventName, handler);
      },
      trigger(eventName, payload, ack) {
        handlers.get(eventName)(payload, ack);
      },
      join(roomId) {
        if (!roomMembers.has(roomId)) {
          roomMembers.set(roomId, new Set());
        }

        roomMembers.get(roomId).add(id);
      },
      leave(roomId) {
        roomMembers.get(roomId)?.delete(id);
      },
      to(roomId) {
        return {
          emit(eventName, payload) {
            emitToRoom(roomId, eventName, payload, id);
          },
        };
      },
      emit(eventName, payload) {
        this.received.push({ name: eventName, payload });
      },
      io,
    };
  }

  function emitToRoom(roomId, eventName, payload, excludedSocketId) {
    if (sockets.has(roomId)) {
      if (roomId !== excludedSocketId) {
        sockets.get(roomId).emit(eventName, payload);
      }
      return;
    }

    for (const socketId of roomMembers.get(roomId) || []) {
      if (socketId !== excludedSocketId) {
        sockets.get(socketId).emit(eventName, payload);
      }
    }
  }
}
