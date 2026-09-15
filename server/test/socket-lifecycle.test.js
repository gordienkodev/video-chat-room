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
    for (const socketId of roomMembers.get(roomId) || []) {
      if (socketId !== excludedSocketId) {
        sockets.get(socketId).emit(eventName, payload);
      }
    }
  }
}
