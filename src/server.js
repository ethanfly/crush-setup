"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createHost } = require("./session-host");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": typeof body === "object" && !Buffer.isBuffer(body) ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function createServer({ host = createHost(), uiDir } = {}) {
  const root = uiDir || path.join(__dirname, "..", "ui");

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    try {
      if (url.pathname === "/api/meta" && req.method === "GET") {
        return send(res, 200, host.meta());
      }
      if (url.pathname === "/api/state" && req.method === "GET") {
        return send(res, 200, host.state());
      }
      if (url.pathname === "/api/load" && req.method === "POST") {
        const body = await readBody(req);
        return send(res, 200, await host.load(body));
      }
      if (url.pathname === "/api/save" && req.method === "POST") {
        return send(res, 200, await host.save());
      }
      if (url.pathname === "/api/reload" && req.method === "POST") {
        return send(res, 200, await host.reload());
      }
      if (url.pathname === "/api/apply" && req.method === "POST") {
        const body = await readBody(req);
        return send(res, 200, await host.apply(body.op, body.args || []));
      }
      if (url.pathname === "/api/discover-models" && req.method === "POST") {
        const body = await readBody(req);
        return send(res, 200, await host.discoverModels(body));
      }
      if (url.pathname === "/api/self-check" && req.method === "GET") {
        const os = require("node:os");
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "crush-setup-self-"));
        try {
          return send(res, 200, host.persistProbe(tmp));
        } finally {
          fs.rmSync(tmp, { recursive: true, force: true });
        }
      }

      let filePath = path.normalize(path.join(root, url.pathname === "/" ? "index.html" : url.pathname));
      if (!filePath.startsWith(root)) return send(res, 403, "forbidden");
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        return send(res, 404, "not found");
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      send(res, 500, { error: err.message || String(err) });
    }
  });
}

function listen(port = 0) {
  const server = createServer();
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: addr.port, url: `http://127.0.0.1:${addr.port}/` });
    });
  });
}

module.exports = { createServer, listen };
