"use strict";

const NAME_MAX_LENGTH = 30;
const ROOM_ID_MIN_LENGTH = 6;
const ROOM_ID_MAX_LENGTH = 64;
const CHAT_MESSAGE_MAX_LENGTH = 1000;

const NAME_PATTERN = /^[\p{L}\p{N}_ -]+$/u;
const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateName(input) {
  if (typeof input !== "string") {
    return invalid("INVALID_NAME", "Name must be a string");
  }

  const value = input.trim();

  if (value.length === 0) {
    return invalid("INVALID_NAME", "Name is required");
  }

  if (value.length > NAME_MAX_LENGTH) {
    return invalid("INVALID_NAME", `Name must be ${NAME_MAX_LENGTH} characters or less`);
  }

  if (!NAME_PATTERN.test(value)) {
    return invalid("INVALID_NAME", "Name contains unsupported characters");
  }

  return valid(value);
}

function validateRoomId(input) {
  if (typeof input !== "string") {
    return invalid("INVALID_ROOM_ID", "Room ID must be a string");
  }

  const value = input.trim();

  if (value.length < ROOM_ID_MIN_LENGTH || value.length > ROOM_ID_MAX_LENGTH) {
    return invalid(
      "INVALID_ROOM_ID",
      `Room ID must be between ${ROOM_ID_MIN_LENGTH} and ${ROOM_ID_MAX_LENGTH} characters`,
    );
  }

  if (!ROOM_ID_PATTERN.test(value)) {
    return invalid("INVALID_ROOM_ID", "Room ID contains unsupported characters");
  }

  return valid(value);
}

function validateChatMessage(input) {
  if (typeof input !== "string") {
    return invalid("INVALID_CHAT_MESSAGE", "Chat message must be a string");
  }

  const value = input.trim();

  if (value.length === 0) {
    return invalid("INVALID_CHAT_MESSAGE", "Chat message is required");
  }

  if (value.length > CHAT_MESSAGE_MAX_LENGTH) {
    return invalid(
      "INVALID_CHAT_MESSAGE",
      `Chat message must be ${CHAT_MESSAGE_MAX_LENGTH} characters or less`,
    );
  }

  return valid(value);
}

function valid(value) {
  return {
    ok: true,
    value,
  };
}

function invalid(code, message) {
  return {
    ok: false,
    code,
    message,
  };
}

module.exports = {
  CHAT_MESSAGE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  ROOM_ID_MAX_LENGTH,
  ROOM_ID_MIN_LENGTH,
  validateName,
  validateRoomId,
  validateChatMessage,
};
