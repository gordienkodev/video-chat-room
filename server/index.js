"use strict";

const path = require("node:path");
const cors = require("cors");
const express = require("express");
const { Server } = require("socket.io");
const { createHttpServer } = require("./src/http/createHttpServer");
const { createRoomStore } = require("./src/rooms/roomStore");
const { registerSocketHandlers } = require("./src/socket/handlers");
const validators = require("./src/validation");

const DEFAULT_PORT = 3001;
const DEFAULT_DEV_ORIGIN = "http://localhost:5173";

function createServer(options = {}) {
  const app = express();
  const roomStore = options.roomStore || createRoomStore();
  const corsOrigins = options.corsOrigins || [DEFAULT_DEV_ORIGIN];
  const staticDir = options.staticDir || path.resolve(__dirname, "..", "client", "dist");

  app.use(createCorsMiddleware(corsOrigins));
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }

    res.sendFile(path.join(staticDir, "index.html"), (error) => {
      if (error) {
        next();
      }
    });
  });

  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ["GET", "POST"],
    },
  });

  registerSocketHandlers({ io, roomStore, validators });

  return {
    app,
    httpServer,
    io,
    roomStore,
  };
}

function createCorsMiddleware(corsOrigins) {
  return cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  });
}

function startServer() {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const { httpServer } = createServer();

  httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  return httpServer;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  createHttpServer,
  createRoomStore,
  registerSocketHandlers,
  startServer,
  validators,
};
