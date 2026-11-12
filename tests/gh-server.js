/** Tiny static server that mimics GitHub Pages: unknown paths return 404.html. */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || process.env.PORT || 8080);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json"
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(root, rel));
  const inside = file.startsWith(root + path.sep) || file === root;
  if (!inside || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    fs.createReadStream(path.join(root, "404.html")).pipe(response);
    return;
  }
  const type = types[path.extname(file)] || "application/octet-stream";
  response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  fs.createReadStream(file).pipe(response);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`GhostLinks preview at http://127.0.0.1:${port}`);
});
