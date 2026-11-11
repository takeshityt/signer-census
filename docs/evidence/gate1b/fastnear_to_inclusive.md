# FastNEAR `to_tx_block_height` is inclusive (docs say exclusive)

Observed 2026-11-11 with `POST https://tx.main.fastnear.com/v0/account`
(`account_id=v1.signer, is_real_receiver=true, is_function_call=true`), block h = 223959999:

| range sent | txs_count | list rows heights |
|---|---|---|
| from=h, to=h        | 3 (an empty half-open range would be 0) | [h] |
| from=h, to=h+1      | 4 | [h, h+1] |
| from=h-1, to=h      | 4 | |
| from=h-1, to=h+1    | 5 | |

Splitting [223960000, 223960300] at 223960150: sent as `to=b`: 44 + 47 = 91 != 88 (whole). Sent as `to=b-1`: 41 + 47 = 88 = 88.

Consequence: always send `to = end - 1` for half-open [start, end) ranges. First monthly run without this fix
had sum(months) = total + 1; after the fix the gap is 0 (data/derived/monthly_check.json).
Impact on earlier evidence: docs/evidence/gate1 check C compared txs_count(to=TO) with txs listed below TO; it passed because no listed tx sat exactly at block TO in those windows.
