/** Static preview server for the e2e suite. Mimics GitHub Pages: files are
    served verbatim from the repo root and unknown paths get 404.html with a 404.
    Usage: node server.js [port]   (env: E2E_PORT, default 4317) */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const port = Number(process.argv[2] || process.env.E2E_PORT || 4317);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch {
    rel = "/";
  }
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(root, rel));
  const inside = file.startsWith(root + path.sep);
  const hidden = path.relative(root, file).split(path.sep).some((part) => part.startsWith(".") || part === "node_modules");
  if (!inside || hidden || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404, { "content-type": types[".html"], "cache-control": "no-store" });
    fs.createReadStream(path.join(root, "404.html")).pipe(response);
    return;
  }
  const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
  response.writeHead(200, { "content-type": type, "content-length": fs.statSync(file).size, "cache-control": "no-store" });
  fs.createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`GhostLinks e2e preview at http://127.0.0.1:${port}/`);
});
