"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const backend = require("..");

test("backend exposes CommonJS extension points", () => {
  assert.equal(typeof backend.createHttpServer, "function");
  assert.equal(typeof backend.createRoomStore, "function");
  assert.equal(typeof backend.registerSocketHandlers, "function");
  assert.equal(typeof backend.validators, "object");
});

test("room store scaffold exposes planned operations", () => {
  const roomStore = backend.createRoomStore();

  assert.equal(typeof roomStore.getRoom, "function");
  assert.equal(typeof roomStore.joinRoom, "function");
  assert.equal(typeof roomStore.leaveRoom, "function");
  assert.equal(typeof roomStore.appendMessage, "function");
  assert.equal(typeof roomStore.updateParticipantMedia, "function");
});

test("validation scaffold exposes planned validators", () => {
  assert.equal(typeof backend.validators.validateName, "function");
  assert.equal(typeof backend.validators.validateRoomId, "function");
  assert.equal(typeof backend.validators.validateChatMessage, "function");
});
