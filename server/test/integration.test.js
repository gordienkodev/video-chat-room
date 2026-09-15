"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { io: createClient } = require("socket.io-client");

const { createServer } = require("../index");

test("integration: create/join, fifth participant rejection, and last-slot race", async (t) => {
  const { endpoint, roomStore, connectClient } = await createTestServer(t);
  const owner = await connectClient(endpoint);
  const createAck = await emitWithAck(owner, "room:create", {});

  assert.equal(createAck.ok, true);
  assert.equal(roomStore.getRoom(createAck.roomId).participants.length, 0);

  const firstJoin = await emitWithAck(owner, "room:join", {
    roomId: createAck.roomId,
    name: "Owner",
    media: { audioEnabled: true, videoEnabled: true },
  });

  assert.equal(firstJoin.ok, true);
  assert.equal(firstJoin.selfId, owner.id);
  assert.equal(firstJoin.room.participants.length, 1);

  const second = await connectClient(endpoint);
  const third = await connectClient(endpoint);
  const fourth = await connectClient(endpoint);
  const fifth = await connectClient(endpoint);

  assert.equal((await joinRoom(second, createAck.roomId, "Second")).ok, true);
  assert.equal((await joinRoom(third, createAck.roomId, "Third")).ok, true);
  assert.equal((await joinRoom(fourth, createAck.roomId, "Fourth")).ok, true);

  const rejected = await joinRoom(fifth, createAck.roomId, "Fifth");
  assert.deepEqual(rejected, {
    ok: false,
    code: "ROOM_FULL",
    message: "Комната заполнена",
  });
  assert.equal(roomStore.getRoom(createAck.roomId).participants.length, 4);

  const raceRoom = "race-room";
  const raceA = await connectClient(endpoint);
  const raceB = await connectClient(endpoint);
  const raceC = await connectClient(endpoint);
  const raceD = await connectClient(endpoint);
  const raceE = await connectClient(endpoint);

  await Promise.all([
    joinRoom(raceA, raceRoom, "Race A"),
    joinRoom(raceB, raceRoom, "Race B"),
    joinRoom(raceC, raceRoom, "Race C"),
  ]);

  const raceResults = await Promise.all([
    joinRoom(raceD, raceRoom, "Race D"),
    joinRoom(raceE, raceRoom, "Race E"),
  ]);

  assert.equal(raceResults.filter((result) => result.ok).length, 1);
  assert.equal(raceResults.filter((result) => result.code === "ROOM_FULL").length, 1);
  assert.equal(roomStore.getRoom(raceRoom).participants.length, 4);
});

test("integration: chat broadcast/history, disconnect cleanup, and empty-room deletion", async (t) => {
  const { endpoint, roomStore, connectClient } = await createTestServer(t);
  const roomId = "chat-room";
  const first = await connectClient(endpoint);
  const second = await connectClient(endpoint);

  await joinRoom(first, roomId, "Алекс");
  await joinRoom(second, roomId, "Мария");

  const firstMessage = waitForEvent(first, "chat:message", (message) => message.type === "user");
  const secondMessage = waitForEvent(second, "chat:message", (message) => message.type === "user");
  const sendAck = await emitWithAck(first, "chat:send", { text: "  Привет всем  " });

  assert.equal(sendAck.ok, true);
  assert.equal(sendAck.message.text, "Привет всем");
  assert.equal(sendAck.message.senderId, first.id);
  assert.equal(sendAck.message.senderName, "Алекс");
  assert.deepEqual(await firstMessage, sendAck.message);
  assert.deepEqual(await secondMessage, sendAck.message);

  const late = await connectClient(endpoint);
  const lateJoinAck = await joinRoom(late, roomId, "Ира");
  assert.equal(
    lateJoinAck.room.messages.some(
      (message) => message.type === "user" && message.text === "Привет всем",
    ),
    true,
  );

  second.disconnect();
  await waitForCondition(() => roomStore.getRoom(roomId).participants.length === 2);

  first.disconnect();
  late.disconnect();
  await waitForCondition(() => roomStore.getRoom(roomId) === null);
  assert.equal(roomStore.getRoom(roomId), null);
});

test("integration: signaling relay is addressed to participants in the same room", async (t) => {
  const { endpoint, connectClient } = await createTestServer(t);
  const roomId = "call-room";
  const first = await connectClient(endpoint);
  const second = await connectClient(endpoint);
  const outsider = await connectClient(endpoint);

  await joinRoom(first, roomId, "Caller");
  await joinRoom(second, roomId, "Receiver");
  await joinRoom(outsider, "other-room", "Outsider");

  const offerPromise = waitForEvent(second, "webrtc:offer");
  const offerAck = await emitWithAck(first, "webrtc:offer", {
    to: second.id,
    description: { type: "offer", sdp: "offer-sdp" },
  });

  assert.deepEqual(offerAck, { ok: true });
  assert.deepEqual(await offerPromise, {
    from: first.id,
    description: { type: "offer", sdp: "offer-sdp" },
  });

  const answerPromise = waitForEvent(first, "webrtc:answer");
  const answerAck = await emitWithAck(second, "webrtc:answer", {
    to: first.id,
    description: { type: "answer", sdp: "answer-sdp" },
  });

  assert.deepEqual(answerAck, { ok: true });
  assert.deepEqual(await answerPromise, {
    from: second.id,
    description: { type: "answer", sdp: "answer-sdp" },
  });

  const icePromise = waitForEvent(first, "webrtc:ice-candidate");
  const iceAck = await emitWithAck(second, "webrtc:ice-candidate", {
    to: first.id,
    candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 },
  });

  assert.deepEqual(iceAck, { ok: true });
  assert.deepEqual(await icePromise, {
    from: second.id,
    candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 },
  });

  const outsiderAck = await emitWithAck(first, "webrtc:offer", {
    to: outsider.id,
    description: { type: "offer", sdp: "outside-room" },
  });

  assert.deepEqual(outsiderAck, {
    ok: false,
    code: "RECIPIENT_NOT_IN_ROOM",
    message: "Recipient is not in the same room",
  });
});

async function createTestServer(t) {
  const clients = new Set();
  const { httpServer, io, roomStore } = createServer({
    corsOrigins: ["http://localhost:5173"],
  });

  await new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });

  t.after(async () => {
    for (const client of clients) {
      client.disconnect();
    }

    await closeIo(io);
    await closeHttpServer(httpServer);
  });

  const { port } = httpServer.address();

  return {
    endpoint: `http://127.0.0.1:${port}`,
    roomStore,
    connectClient: async (endpoint) => {
      const client = createClient(endpoint, {
        forceNew: true,
        reconnection: false,
        transports: ["websocket"],
      });

      clients.add(client);
      await waitForConnect(client);
      return client;
    },
  };
}

function waitForConnect(client) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for Socket.io client connection"));
    }, 1000);

    function cleanup() {
      clearTimeout(timeout);
      client.off("connect", onConnect);
      client.off("connect_error", onError);
    }

    function onConnect() {
      cleanup();
      resolve();
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    client.once("connect", onConnect);
    client.once("connect_error", onError);
  });
}

function emitWithAck(client, eventName, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ack from ${eventName}`));
    }, 1000);

    client.emit(eventName, payload, (ack) => {
      clearTimeout(timeout);
      resolve(ack);
    });
  });
}

function waitForEvent(client, eventName, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, 1000);

    function cleanup() {
      clearTimeout(timeout);
      client.off(eventName, onEvent);
    }

    function onEvent(payload) {
      if (!predicate(payload)) {
        return;
      }

      cleanup();
      resolve(payload);
    }

    client.on(eventName, onEvent);
  });
}

async function waitForCondition(predicate) {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > 1000) {
      throw new Error("Timed out waiting for condition");
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function joinRoom(client, roomId, name) {
  return emitWithAck(client, "room:join", {
    roomId,
    name,
    media: { audioEnabled: true, videoEnabled: true },
  });
}

function closeIo(io) {
  return new Promise((resolve) => {
    io.close(resolve);
  });
}

function closeHttpServer(httpServer) {
  return new Promise((resolve, reject) => {
    if (!httpServer.listening) {
      resolve();
      return;
    }

    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
