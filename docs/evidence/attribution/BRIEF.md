# Attribution research brief (shared by all research tasks)

Project: signer-census (repo root = current directory). We measure who calls `sign` on NEAR `v1.signer` (Chain Signatures MPC contract).
Requester = predecessor_id of the `sign` receipt. Your job: gather EVIDENCE to label specific requester accounts. No label without evidence.

HARD RULES
- Read-only. No private keys, no signing, no transactions, no paid services, no API keys. Public endpoints only:
  FastNEAR tx API https://tx.main.fastnear.com (POST /v0/account, /v0/transactions), RPC https://rpc.mainnet.fastnear.com and https://archival-rpc.mainnet.fastnear.com,
  NearBlocks https://api.nearblocks.io/v1/..., GitHub raw/API (unauthenticated), docs sites, web search. At most 3 requests/second overall; retry on HTTP 429 with a pause.
- Do NOT edit any file except the one JSON file named in your task. Do NOT run git commands. Do not touch data/raw.
- Every claim must be backed by something you actually fetched or ran. Quote the exact text (short) or give the exact command/URL + the returned value.
  If you cannot verify something, write it under "unresolved". "unknown" is an acceptable answer. Never guess an owner/company from a name alone.
- Distinguish: (a) official source (docs, project GitHub, announcement by the project), (b) on-chain fact (account creator, creation tx, code hash, keys), (c) your inference from data (say so).
- Confidence: high = official source or on-chain fact directly names the owner/function; medium = several consistent independent signals but no explicit statement; low = a single weak signal.

Useful local data (read-only, use `python3 -I`): `data/derived/sample_parsed.csv.gz` (one row per receipt on v1.signer in a 105k-tx sample; columns include month, cluster_id, tx_hash, tx_block_height, tx_signer, method, predecessor, receipt_status, domain_id, key_version, path, payload_type, payload_hash, callback_status, fulfilled).
domain_id 0 = Secp256k1 (ECDSA payload), 1 = Ed25519 (EdDSA payload); legacy sign args (no domain_id) show key_version=0 and payload_type legacy_bytes.
Per-account profile of the sample (already computed): see the task text.

OUTPUT: write ONE json file (path in your task) with this shape, then reply with a short plain summary (<= 25 lines) of the findings and the unresolved items:
{
  "accounts": [
    {
      "account": "<near account id>",
      "category_suggestion": "<one of: near-infra:fastauth | near-infra:bridge-omni | near-infra:bridge-btc | near-infra:bridge-zcash | aurora | benchmark-test | wallet | third-party-app | intents | unknown>",
      "owner_or_project": "<text or null>",
      "what_it_does": "<one sentence, only what the evidence supports>",
      "target_chain_evidence": "<what chain(s) the signatures are for, with evidence, or 'unknown'>",
      "evidence": [ { "kind": "official-docs|github-source|announcement|onchain|data-inference", "url": "<url or command>", "claim": "<what it shows>", "quote_or_value": "<exact short quote or returned value>" } ],
      "onchain": { "creator_account": "...", "creation_tx": "...", "creation_time_utc": "...", "code_hash": "...", "is_contract": true, "notes": "..." },
      "confidence": "high|medium|low",
      "unresolved": ["..."]
    }
  ]
}
How to get on-chain facts cheaply: NearBlocks `GET https://api.nearblocks.io/v1/account/<id>` returns created.transaction_hash; look the creation tx up with
`POST https://tx.main.fastnear.com/v0/transactions {"tx_hashes":["<hash>"]}` (signer_id = who created it); RPC `view_account` gives code_hash (all-1s hash = no contract);
`view_code` returns wasm (you may inspect exported method names as ASCII strings); `view_access_key_list` lists keys (full-access vs function-call).
