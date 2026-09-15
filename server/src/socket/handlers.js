"use strict";

function registerSocketHandlers({ io, roomStore, validators } = {}) {
  if (!io) {
    throw new TypeError("registerSocketHandlers requires a Socket.io server");
  }

  if (!roomStore) {
    throw new TypeError("registerSocketHandlers requires a room store");
  }

  if (!validators) {
    throw new TypeError("registerSocketHandlers requires validators");
  }
}

module.exports = {
  registerSocketHandlers,
};
