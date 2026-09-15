"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const { createServer } = require("..");

test("HTTP entrypoint responds to GET /health", async (t) => {
  const server = createServer();
  const baseUrl = await listen(server.httpServer);

  t.after(() => close(server));

  const response = await request(`${baseUrl}/health`);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"].startsWith("application/json"), true);
  assert.deepEqual(JSON.parse(response.body), { status: "ok" });
});

test("HTTP entrypoint allows the Vite dev origin", async (t) => {
  const server = createServer();
  const baseUrl = await listen(server.httpServer);

  t.after(() => close(server));

  const response = await request(`${baseUrl}/health`, {
    Origin: "http://localhost:5173",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["access-control-allow-origin"], "http://localhost:5173");
});

test("HTTP entrypoint creates a Socket.io server with registered handlers", () => {
  const server = createServer();

  assert.equal(typeof server.io.on, "function");
  assert.equal(typeof server.httpServer.listen, "function");

  close(server);
});

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://${address.address}:${address.port}`);
    });
  });
}

function request(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let body = "";

      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on("error", reject);
  });
}

function close(server) {
  server.io.close();
  server.httpServer.close();
}
