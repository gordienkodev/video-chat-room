"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { MAX_PARTICIPANTS_PER_ROOM, createRoomStore } = require("../src/rooms/roomStore");

test("createRoom creates a room and getRoom returns a defensive snapshot", () => {
  const store = createRoomStore({ now: () => 1000, createId: () => "room-1" });

  const room = store.createRoom();
  assert.deepEqual(room, {
    id: "room-1",
    participants: [],
    messages: [],
    createdAt: 1000,
  });

  room.participants.push({ id: "outside-change" });

  assert.deepEqual(store.getRoom("room-1").participants, []);
});

test("joinRoom creates a room when needed and stores participant media", () => {
  const store = createRoomStore({ now: () => 2000 });

  const result = store.joinRoom("room-join", {
    id: "socket-1",
    name: "Алекс",
    media: { audioEnabled: true, videoEnabled: false },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.participant, {
    id: "socket-1",
    name: "Алекс",
    joinedAt: 2000,
    media: { audioEnabled: true, videoEnabled: false },
  });
  assert.deepEqual(result.room.participants, [result.participant]);
});

test("joinRoom enforces the four participant limit inside the join operation", () => {
  const store = createRoomStore({ now: () => 3000 });

  for (let index = 1; index <= MAX_PARTICIPANTS_PER_ROOM; index += 1) {
    const result = store.joinRoom("room-full", {
      id: `socket-${index}`,
      name: `User ${index}`,
      media: { audioEnabled: true, videoEnabled: true },
    });

    assert.equal(result.ok, true);
  }

  const rejected = store.joinRoom("room-full", {
    id: "socket-5",
    name: "User 5",
    media: { audioEnabled: true, videoEnabled: true },
  });

  assert.deepEqual(rejected, {
    ok: false,
    code: "ROOM_FULL",
    message: "Комната заполнена",
  });
  assert.equal(store.getRoom("room-full").participants.length, MAX_PARTICIPANTS_PER_ROOM);
});

test("leaveRoom removes participants and deletes an empty room with its message history", () => {
  const store = createRoomStore({ now: () => 4000, createId: () => "message-1" });

  store.joinRoom("room-lifecycle", {
    id: "socket-1",
    name: "Алекс",
    media: { audioEnabled: true, videoEnabled: true },
  });
  store.appendMessage("room-lifecycle", {
    type: "user",
    senderId: "socket-1",
    senderName: "Алекс",
    text: "Привет",
  });

  const left = store.leaveRoom("room-lifecycle", "socket-1");

  assert.equal(left.ok, true);
  assert.equal(left.roomDeleted, true);
  assert.equal(left.room, null);
  assert.equal(store.getRoom("room-lifecycle"), null);
});

test("appendMessage stores user and system messages for the room lifetime", () => {
  let id = 0;
  const store = createRoomStore({
    now: () => 5000,
    createId: () => `message-${(id += 1)}`,
  });

  store.createRoom("room-chat");

  const userMessage = store.appendMessage("room-chat", {
    type: "user",
    senderId: "socket-1",
    senderName: "Алекс",
    text: "Привет",
  });
  const systemMessage = store.appendMessage("room-chat", {
    type: "system",
    text: "Алекс вошёл в комнату",
  });

  assert.equal(userMessage.ok, true);
  assert.equal(systemMessage.ok, true);
  assert.deepEqual(store.getRoom("room-chat").messages, [
    {
      id: "message-1",
      type: "user",
      senderId: "socket-1",
      senderName: "Алекс",
      text: "Привет",
      createdAt: 5000,
    },
    {
      id: "message-2",
      type: "system",
      text: "Алекс вошёл в комнату",
      createdAt: 5000,
    },
  ]);
});

test("updateParticipantMedia changes only the selected participant media state", () => {
  const store = createRoomStore({ now: () => 6000 });

  store.joinRoom("room-media", {
    id: "socket-1",
    name: "Алекс",
    media: { audioEnabled: true, videoEnabled: true },
  });
  store.joinRoom("room-media", {
    id: "socket-2",
    name: "Мария",
    media: { audioEnabled: true, videoEnabled: true },
  });

  const result = store.updateParticipantMedia("room-media", "socket-1", {
    audioEnabled: false,
    videoEnabled: true,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    store.getRoom("room-media").participants.map((participant) => participant.media),
    [
      { audioEnabled: false, videoEnabled: true },
      { audioEnabled: true, videoEnabled: true },
    ],
  );
});
