"use strict";

function createRoomStore() {
  return {
    getRoom,
    joinRoom,
    leaveRoom,
    appendMessage,
    updateParticipantMedia,
  };
}

function getRoom() {
  throw new Error("roomStore.getRoom is not implemented yet");
}

function joinRoom() {
  throw new Error("roomStore.joinRoom is not implemented yet");
}

function leaveRoom() {
  throw new Error("roomStore.leaveRoom is not implemented yet");
}

function appendMessage() {
  throw new Error("roomStore.appendMessage is not implemented yet");
}

function updateParticipantMedia() {
  throw new Error("roomStore.updateParticipantMedia is not implemented yet");
}

module.exports = {
  createRoomStore,
};
