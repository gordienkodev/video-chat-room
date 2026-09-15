"use strict";

const { randomUUID } = require("node:crypto");

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

  io.on("connection", (socket) => {
    socket.on("room:create", (_payload, ack) => {
      const roomId = createUniqueRoomId(roomStore);
      roomStore.createRoom(roomId);

      acknowledge(ack, {
        ok: true,
        roomId,
      });
    });

    socket.on("room:join", (payload = {}, ack) => {
      const data = isPlainObject(payload) ? payload : {};
      const roomIdResult = validators.validateRoomId(data.roomId);
      if (!roomIdResult.ok) {
        acknowledge(ack, roomIdResult);
        return;
      }

      const nameResult = validators.validateName(data.name);
      if (!nameResult.ok) {
        acknowledge(ack, nameResult);
        return;
      }

      const roomId = roomIdResult.value;
      const previousRoomId = socket.data?.roomId;
      const alreadyInRoom = previousRoomId === roomId;
      const participant = {
        id: socket.id,
        name: nameResult.value,
        media: data.media,
      };
      const result = roomStore.joinRoom(roomId, participant);

      if (!result.ok) {
        acknowledge(ack, result);
        return;
      }

      if (previousRoomId && !alreadyInRoom) {
        leaveCurrentRoom(socket, roomStore, io);
      }

      socket.join(roomId);
      socket.data.roomId = roomId;

      const systemMessage = alreadyInRoom
        ? null
        : appendSystemMessage(roomStore, roomId, `${result.participant.name} вошёл в комнату`);

      if (!alreadyInRoom) {
        socket.to(roomId).emit("room:participant-joined", {
          participant: result.participant,
        });
      }
      emitParticipants(io, roomId, roomStore);
      emitSystemMessage(io, roomId, systemMessage);

      acknowledge(ack, {
        ok: true,
        selfId: socket.id,
        room: roomStore.getRoom(roomId),
      });
    });

    socket.on("room:leave", (_payload, ack) => {
      const result = leaveCurrentRoom(socket, roomStore, io);

      acknowledge(ack, {
        ok: true,
        left: result.ok,
      });
    });

    socket.on("chat:send", (payload = {}, ack) => {
      const roomId = socket.data?.roomId;
      const room = roomId ? roomStore.getRoom(roomId) : null;
      const sender = room?.participants.find((participant) => participant.id === socket.id);

      if (!room || !sender) {
        acknowledge(ack, {
          ok: false,
          code: "NOT_IN_ROOM",
          message: "Socket is not in a room",
        });
        return;
      }

      const data = isPlainObject(payload) ? payload : {};
      const messageResult = validators.validateChatMessage(data.text);
      if (!messageResult.ok) {
        acknowledge(ack, messageResult);
        return;
      }

      const appendResult = roomStore.appendMessage(roomId, {
        type: "user",
        senderId: socket.id,
        senderName: sender.name,
        text: messageResult.value,
      });

      if (!appendResult.ok) {
        acknowledge(ack, appendResult);
        return;
      }

      io.to(roomId).emit("chat:message", appendResult.message);

      acknowledge(ack, {
        ok: true,
        message: appendResult.message,
      });
    });

    socket.on("disconnect", () => {
      leaveCurrentRoom(socket, roomStore, io);
    });
  });
}

function createUniqueRoomId(roomStore) {
  let roomId = randomUUID();

  while (roomStore.getRoom(roomId)) {
    roomId = randomUUID();
  }

  return roomId;
}

function leaveCurrentRoom(socket, roomStore, io) {
  const roomId = socket.data?.roomId;

  if (!roomId) {
    return {
      ok: false,
    };
  }

  const result = roomStore.leaveRoom(roomId, socket.id);

  if (typeof socket.leave === "function") {
    socket.leave(roomId);
  }

  delete socket.data.roomId;

  if (result.ok && io) {
    const systemMessage = result.roomDeleted
      ? null
      : appendSystemMessage(roomStore, roomId, `${result.participant.name} вышел из комнаты`);

    socket.to(roomId).emit("room:participant-left", {
      participantId: result.participant.id,
      name: result.participant.name,
    });
    emitParticipants(io, roomId, roomStore);
    emitSystemMessage(io, roomId, systemMessage);
  }

  return result;
}

function appendSystemMessage(roomStore, roomId, text) {
  const result = roomStore.appendMessage(roomId, {
    type: "system",
    text,
  });

  return result.ok ? result.message : null;
}

function emitParticipants(io, roomId, roomStore) {
  const room = roomStore.getRoom(roomId);

  io.to(roomId).emit("room:participants", {
    participants: room ? room.participants : [],
  });
}

function emitSystemMessage(io, roomId, message) {
  if (message) {
    io.to(roomId).emit("chat:message", message);
  }
}

function acknowledge(ack, payload) {
  if (typeof ack === "function") {
    ack(payload);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  registerSocketHandlers,
};
