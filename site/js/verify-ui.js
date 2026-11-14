// "Verify it yourself": on an explicit click, pick a random sampled sign transaction, ask a public NEAR archival RPC (fallback: NearBlocks)
// and show expected vs on-chain values. Network is used ONLY here, only after the click.
import { fromRpc, fromNearblocks, compare } from "./verify-core.js";
import { esc } from "./md.js";

const timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
async function rpc(url, method, params) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: timeout(15000) });
  if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
  const j = await r.json();
  if (j.error || !j.result) throw new Error(j.error?.data ?? j.error?.name ?? "no result");
  return j.result;
}
async function viaRpc(cfg, exp) {
  const res = await rpc(cfg.rpc, "EXPERIMENTAL_tx_status", { tx_hash: exp.tx_hash, sender_account_id: exp.tx_signer, wait_until: "FINAL" });
  const got = fromRpc(res);
  const blk = await rpc(cfg.rpc, "block", { block_id: got.tx_block_hash });
  return { source: new URL(cfg.rpc).host, got, height: blk.header.height };
}
async function viaNearblocks(cfg, exp) {
  const get = async (p) => { const r = await fetch(`${cfg.nearblocks}${p}`, { signal: timeout(15000) }); if (!r.ok) throw new Error(`NearBlocks HTTP ${r.status}`); return r.json(); };
  const [t, rc] = await Promise.all([get(`/v1/txns/${exp.tx_hash}`), get(`/v2/txns/${exp.tx_hash}/receipts`)]);
  const got = fromNearblocks(t, rc);
  if (!got.tx_signer) throw new Error("transaction not found");
  return { source: new URL(cfg.nearblocks).host, got, height: got.tx_block_height };
}

/** Random pick with the browser's crypto source (nothing is sent anywhere). */
export const pickRandom = (list) => list[crypto.getRandomValues(new Uint32Array(1))[0] % list.length];

/** "fast-auth.near|Success, x|Failure" -> "fast-auth.near · Success, x · Failure" */
export const fmtSigns = (signs) => signs.map((x) => x.replace("|", " · ")).join(", ");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * button, log (ol), counter (p), out (case card host), sample (verify-sample.json), command.
 * Before the click: an empty case card skeleton. On click: a typed log, rows fill one by one, then the badge stamps in.
 */
export function setupVerify({ button, log, counter, out, sample, command }) {
  const LABELS = ["Transaction signer", "Block height", "Sign requester · status"];
  const card = (head, flag, rows, foot = "") => `<div class="vcase"><div class="ch-line"><span class="micro">${head}</span>${flag}</div>
    <table><thead><tr><th scope="col">Check</th><th scope="col">Ours</th><th scope="col">Chain</th><th scope="col">Status</th></tr></thead><tbody>${rows}</tbody></table>${foot}</div>`;
  const skeletonRows = LABELS.map((l, i) => `<tr data-r="${i}"><th scope="row">${esc(l)}</th><td>—</td><td>—</td><td class="st">—</td></tr>`).join("");
  out.innerHTML = card("Case · no transaction yet", `<span class="flag idle">Waiting</span>`, skeletonRows);
  let checked = 0, ok = 0;
  const say = async (text, { wait = false } = {}) => {
    const li = document.createElement("li"); log.appendChild(li);
    if (calm()) { li.textContent = text; } else { for (let i = 1; i <= text.length; i++) { li.textContent = text.slice(0, i); await sleep(12); } }
    if (wait) li.classList.add("wait");
    return li;
  };
  button.addEventListener("click", async () => {
    const exp = pickRandom(sample.txs);
    button.disabled = true; out.setAttribute("aria-busy", "true");
    log.innerHTML = "";
    const old = out.querySelector(".vcase"); if (old && !calm()) { old.classList.add("fading"); await sleep(220); }
    out.innerHTML = card(`Case · tx ${esc(exp.tx_hash.slice(0, 10))}… · ${esc(exp.month)}`, `<span class="flag idle">Checking</span>`, skeletonRows);
    await say("→ picking a random sampled transaction");
    const host = new URL(sample.rpc).host;
    const asking = await say(`→ asking ${host}…`, { wait: true });
    let res = null; const errs = [];
    for (const f of [viaRpc, viaNearblocks]) {
      try { res = await f(sample, exp); break; } catch (e) { errs.push(String(e.message ?? e)); if (f === viaRpc) { asking.classList.remove("wait"); await say(`→ ${host} did not answer, asking ${new URL(sample.nearblocks).host}…`, { wait: true }); } }
    }
    log.querySelectorAll(".wait").forEach((li) => li.classList.remove("wait"));
    checked++;
    if (!res) {
      await say(`→ no public node reachable from this browser (${errs.join("; ")}). That is the network, not the data. Run it on your machine: ${command}`);
      out.innerHTML = card(`Case · tx ${esc(exp.tx_hash.slice(0, 10))}…`, `<span class="flag bad stamp">Offline</span>`, skeletonRows);
      counter.textContent = `checked by you: ${ok} of ${checked} ✓`;
      button.disabled = false; out.removeAttribute("aria-busy");
      return;
    }
    await say("→ comparing with our record");
    const cmp = compare(exp, res.got, { height: res.height });
    const vals = [[exp.tx_signer, res.got.tx_signer], [String(exp.tx_block_height), String(res.height)], [fmtSigns(exp.signs), fmtSigns(res.got.signs)]];
    const body = out.querySelector("tbody"); out.querySelector("thead th:nth-child(3)").textContent = `Chain (${res.source})`;
    for (const [i, [a, b]] of vals.entries()) {
      const tr = body.querySelector(`tr[data-r="${i}"]`), good = a === b;
      tr.innerHTML = `<th scope="row">${esc(LABELS[i])}</th><td>${esc(a)}</td><td>${esc(b)}</td><td class="st ${good ? "ok" : "bad"}"><span class="tick">${good ? "✓" : "✗"}</span></td>`;
      tr.classList.add("filled");
      if (!calm()) await sleep(260);
    }
    if (cmp.ok) ok++;
    const flag = out.querySelector(".flag"); flag.className = `flag ${cmp.ok ? "ok" : "bad"} stamp`; flag.textContent = cmp.ok ? "Parsing re-checked" : "Mismatch";
    out.querySelector(".vcase").insertAdjacentHTML("beforeend", `<p>${cmp.ok ? "All three match." : "Mismatch: " + esc(cmp.problems.join("; "))} <a href="https://nearblocks.io/txns/${esc(exp.tx_hash)}" rel="noopener noreferrer">${esc(exp.tx_hash.slice(0, 8))}… on NearBlocks</a>. This checks the parsing of one transaction, not the estimate.</p>`);
    counter.textContent = `checked by you: ${ok} of ${checked} ✓`;
    button.disabled = false; out.removeAttribute("aria-busy");
  });
}
