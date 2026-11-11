# GATE 1b: audit experiments (E1–E4)

Offline (uses docs/evidence/gate1/ raw data):  `python3 -I docs/evidence/gate1b/e1_e2_offline.py`  -> e1_e2_results.json
Network (read-only, paced ~3 req/s, no keys):   `python3 -I docs/evidence/gate1b/e3_e4_network.py`  -> e3_e4_results.json
Follow-up (one tx that hit HTTP 429 in the main run): e3_followup_first_fc_*.json

Results are summarised in the session report; numbers here are the raw evidence.
