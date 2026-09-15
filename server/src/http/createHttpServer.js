"use strict";

const http = require("http");

function createHttpServer(app) {
  if (!app) {
    throw new TypeError("createHttpServer requires an Express-compatible app");
  }

  return http.createServer(app);
}

module.exports = {
  createHttpServer,
};
