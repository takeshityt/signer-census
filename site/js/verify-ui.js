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

export function setupVerify({ button, out, sample, command }) {
  const row = (label, expected, got, ok) => `<tr><th scope="row">${esc(label)}</th><td>${esc(expected)}</td><td>${esc(got)}</td><td class="${ok ? "ok" : "bad"}">${ok ? "✓" : "✗"}</td></tr>`;
  button.addEventListener("click", async () => {
    const exp = pickRandom(sample.txs);
    button.disabled = true; out.setAttribute("aria-busy", "true");
    out.innerHTML = `<p class="micro">Asking a public NEAR archival node about <span class="mono">${esc(exp.tx_hash.slice(0, 10))}…</span></p>`;
    let res = null, errs = [];
    for (const f of [viaRpc, viaNearblocks]) { try { res = await f(sample, exp); break; } catch (e) { errs.push(String(e.message ?? e)); } }
    button.disabled = false; out.removeAttribute("aria-busy");
    if (!res) {
      out.innerHTML = `<div class="vcase"><div class="ch-line"><span class="micro">Case · tx ${esc(exp.tx_hash.slice(0, 10))}…</span><span class="flag bad">Offline</span></div><p>Could not reach a public node from this browser (${esc(errs.join("; "))}). That is the network, not the data. Check it from your own machine instead: <code>${esc(command)}</code></p></div>`;
      return;
    }
    const cmp = compare(exp, res.got, { height: res.height });
    const gotSigns = res.got.signs.join(", "), expSigns = exp.signs.join(", ");
    const okSigner = res.got.tx_signer === exp.tx_signer, okH = res.height === exp.tx_block_height, okS = gotSigns === expSigns;
    out.innerHTML = `<div class="vcase"><div class="ch-line"><span class="micro">Case · tx ${esc(exp.tx_hash.slice(0, 10))}… · ${esc(exp.month)}</span><span class="flag ${cmp.ok ? "ok" : "bad"}">${cmp.ok ? "Verified on-chain" : "Mismatch"}</span></div><table><thead><tr><th scope="col">Check</th><th scope="col">Our data</th><th scope="col">${esc(res.source)}</th><th scope="col"><span class="sr-only">Result</span></th></tr></thead><tbody>
      ${row("Transaction signer", exp.tx_signer, res.got.tx_signer, okSigner)}
      ${row("Block height", String(exp.tx_block_height), String(res.height), okH)}
      ${row("Requester and status of the sign receipt(s)", expSigns, gotSigns, okS)}
      </tbody></table><p>${cmp.ok ? "All three match." : "Mismatch: " + esc(cmp.problems.join("; "))} <a href="https://nearblocks.io/txns/${esc(exp.tx_hash)}" rel="noopener noreferrer">${esc(exp.tx_hash.slice(0, 8))}… on NearBlocks</a>. This checks the parsing of one transaction, not the estimate.</p></div>`;
  });
}
