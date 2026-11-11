#!/usr/bin/env node
// `npm run site`: tiny static server for site/ on 127.0.0.1 (no dependencies, no network access beyond localhost).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname } from "node:path";

const ROOT = new URL("../site/", import.meta.url).pathname;
const port = Number(process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1] : process.env.PORT ?? 4173);
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }
    await stat(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch { res.writeHead(404, { "content-type": "text/plain" }).end("not found"); }
}).listen(port, "127.0.0.1", () => console.log(`dashboard: http://127.0.0.1:${port}/  (Ctrl+C to stop)`));
