"use strict";

const { randomUUID } = require("node:crypto");

const MAX_PARTICIPANTS_PER_ROOM = 4;

function createRoomStore(options = {}) {
  const rooms = new Map();
  const now = options.now || Date.now;
  const createId = options.createId || randomUUID;

  return {
    createRoom,
    getRoom,
    joinRoom,
    leaveRoom,
    appendMessage,
    updateParticipantMedia,
  };

  function createRoom(roomId = createId()) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        participants: new Map(),
        messages: [],
        createdAt: now(),
      });
    }

    return snapshotRoom(rooms.get(roomId));
  }

  function getRoom(roomId) {
    const room = rooms.get(roomId);
    return room ? snapshotRoom(room) : null;
  }

  function joinRoom(roomId, participant) {
    const room = getOrCreateRoom(roomId);
    const participantId = participant.id;

    if (!room.participants.has(participantId) && room.participants.size >= MAX_PARTICIPANTS_PER_ROOM) {
      return {
        ok: false,
        code: "ROOM_FULL",
        message: "Комната заполнена",
      };
    }

    const normalizedParticipant = {
      id: participantId,
      name: participant.name,
      joinedAt: room.participants.get(participantId)?.joinedAt ?? now(),
      media: normalizeMedia(participant.media),
    };

    room.participants.set(participantId, normalizedParticipant);

    return {
      ok: true,
      participant: snapshotParticipant(normalizedParticipant),
      room: snapshotRoom(room),
    };
  }

  function leaveRoom(roomId, participantId) {
    const room = rooms.get(roomId);

    if (!room || !room.participants.has(participantId)) {
      return {
        ok: false,
        code: "PARTICIPANT_NOT_FOUND",
        message: "Participant is not in the room",
      };
    }

    const participant = room.participants.get(participantId);
    room.participants.delete(participantId);

    if (room.participants.size === 0) {
      rooms.delete(roomId);

      return {
        ok: true,
        participant: snapshotParticipant(participant),
        room: null,
        roomDeleted: true,
      };
    }

    return {
      ok: true,
      participant: snapshotParticipant(participant),
      room: snapshotRoom(room),
      roomDeleted: false,
    };
  }

  function appendMessage(roomId, message) {
    const room = rooms.get(roomId);

    if (!room) {
      return {
        ok: false,
        code: "ROOM_NOT_FOUND",
        message: "Room does not exist",
      };
    }

    const chatMessage = {
      id: message.id || createId(),
      type: message.type,
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text,
      createdAt: message.createdAt ?? now(),
    };

    room.messages.push(chatMessage);

    return {
      ok: true,
      message: snapshotMessage(chatMessage),
      room: snapshotRoom(room),
    };
  }

  function updateParticipantMedia(roomId, participantId, media) {
    const room = rooms.get(roomId);
    const participant = room?.participants.get(participantId);

    if (!participant) {
      return {
        ok: false,
        code: "PARTICIPANT_NOT_FOUND",
        message: "Participant is not in the room",
      };
    }

    participant.media = normalizeMedia(media);

    return {
      ok: true,
      participant: snapshotParticipant(participant),
      room: snapshotRoom(room),
    };
  }

  function getOrCreateRoom(roomId) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        participants: new Map(),
        messages: [],
        createdAt: now(),
      });
    }

    return rooms.get(roomId);
  }
}

function normalizeMedia(media = {}) {
  return {
    audioEnabled: Boolean(media.audioEnabled),
    videoEnabled: Boolean(media.videoEnabled),
  };
}

function snapshotRoom(room) {
  return {
    id: room.id,
    participants: Array.from(room.participants.values(), snapshotParticipant),
    messages: room.messages.map(snapshotMessage),
    createdAt: room.createdAt,
  };
}

function snapshotParticipant(participant) {
  return {
    id: participant.id,
    name: participant.name,
    joinedAt: participant.joinedAt,
    media: { ...participant.media },
  };
}

function snapshotMessage(message) {
  const snapshot = {
    id: message.id,
    type: message.type,
    text: message.text,
    createdAt: message.createdAt,
  };

  if (message.senderId !== undefined) {
    snapshot.senderId = message.senderId;
  }

  if (message.senderName !== undefined) {
    snapshot.senderName = message.senderName;
  }

  return snapshot;
}

module.exports = {
  MAX_PARTICIPANTS_PER_ROOM,
  createRoomStore,
};
