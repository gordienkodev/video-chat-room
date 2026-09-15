"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CHAT_MESSAGE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  ROOM_ID_MAX_LENGTH,
  ROOM_ID_MIN_LENGTH,
  validateChatMessage,
  validateName,
  validateRoomId,
} = require("../src/validation");

test("validateName trims and accepts allowed display names", () => {
  assert.deepEqual(validateName("  Алекс 42_Тест-User  "), {
    ok: true,
    value: "Алекс 42_Тест-User",
  });
});

test("validateName rejects empty, too long, non-string, and special-character names", () => {
  assert.equal(validateName("   ").ok, false);
  assert.equal(validateName("a".repeat(NAME_MAX_LENGTH + 1)).ok, false);
  assert.equal(validateName(null).ok, false);
  assert.equal(validateName("<script>").ok, false);
  assert.equal(validateName("Alex!").ok, false);
});

test("validateRoomId accepts URL-safe IDs inside length limits", () => {
  const minLengthRoomId = "a".repeat(ROOM_ID_MIN_LENGTH);
  const maxLengthRoomId = "a".repeat(ROOM_ID_MAX_LENGTH);

  assert.deepEqual(validateRoomId("  room_123-ABC  "), {
    ok: true,
    value: "room_123-ABC",
  });
  assert.deepEqual(validateRoomId(minLengthRoomId), {
    ok: true,
    value: minLengthRoomId,
  });
  assert.deepEqual(validateRoomId(maxLengthRoomId), {
    ok: true,
    value: maxLengthRoomId,
  });
});

test("validateRoomId rejects invalid lengths, non-string values, and unsafe characters", () => {
  assert.equal(validateRoomId("a".repeat(ROOM_ID_MIN_LENGTH - 1)).ok, false);
  assert.equal(validateRoomId("a".repeat(ROOM_ID_MAX_LENGTH + 1)).ok, false);
  assert.equal(validateRoomId(undefined).ok, false);
  assert.equal(validateRoomId("room.123").ok, false);
  assert.equal(validateRoomId("room/123").ok, false);
  assert.equal(validateRoomId("комната123").ok, false);
});

test("validateChatMessage trims and accepts non-empty messages up to the limit", () => {
  const maxLengthMessage = "a".repeat(CHAT_MESSAGE_MAX_LENGTH);

  assert.deepEqual(validateChatMessage("  Привет всем  "), {
    ok: true,
    value: "Привет всем",
  });
  assert.deepEqual(validateChatMessage(maxLengthMessage), {
    ok: true,
    value: maxLengthMessage,
  });
});

test("validateChatMessage rejects empty, too long, and non-string messages", () => {
  assert.equal(validateChatMessage("   ").ok, false);
  assert.equal(validateChatMessage("a".repeat(CHAT_MESSAGE_MAX_LENGTH + 1)).ok, false);
  assert.equal(validateChatMessage({ text: "hello" }).ok, false);
});
