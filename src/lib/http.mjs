// Rate-limited JSON client with exponential backoff. Keyless, read-only.
// Global budget: at most ~3 requests/second (CLAUDE.md). On HTTP 429 the spacing grows; it relaxes slowly on success.
const MIN_SPACING_MS = 340;
const MAX_SPACING_MS = 700; // 429s were measured to be random server-side load shedding, not caused by our pace (docs/evidence/gate1b)
let spacing = MIN_SPACING_MS;
let nextSlot = 0;
export const stats = { requests: 0, retries: 0, http429: 0, http5xx: 0, otherErrors: 0 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function paced() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + spacing;
  if (wait) await sleep(wait);
  stats.requests++;
}

/** POST (or GET when body is undefined) and return parsed JSON. Retries 429/5xx/network errors with exponential backoff. */
export async function requestJson(url, body, { maxAttempts = 8, timeoutMs = 60000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await paced();
    try {
      const res = await fetch(url, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429) {
        stats.http429++;
        spacing = Math.min(MAX_SPACING_MS, spacing * 1.1);
        throw new Error("HTTP 429");
      }
      if (res.status >= 500) {
        stats.http5xx++;
        throw new Error(`HTTP ${res.status}`);
      }
      spacing = Math.max(MIN_SPACING_MS, spacing * 0.9);
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`non-JSON response (HTTP ${res.status}): ${text.slice(0, 120)}`);
      }
    } catch (e) {
      lastErr = e;
      if (!/HTTP 429|HTTP 5/.test(String(e))) stats.otherErrors++;
      stats.retries++;
      await sleep(Math.min(60000, 700 * 2 ** attempt) + Math.random() * 300);
    }
  }
  throw new Error(`giving up on ${url}: ${lastErr}`);
}

/** JSON-RPC call; throws an Error with `.rpc` set when the node returns an error object. */
export async function rpcCall(url, method, params) {
  const d = await requestJson(url, { jsonrpc: "2.0", id: 1, method, params });
  if (d.error) {
    const e = new Error(`${method}: ${JSON.stringify(d.error).slice(0, 200)}`);
    e.rpc = d.error;
    throw e;
  }
  return d.result;
}
