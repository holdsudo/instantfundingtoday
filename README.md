# Instant Funding Today — v2 (not deployed)

Static site, zero dependencies. Replaces the current Next.js form at instantfundingtoday.net.
**Nothing here has been deployed.** The live site is untouched; a copy of it is in
`~/RESTORE_POINTS/instantfundingtoday-live-20261020/`.

## What it keeps from the live site
- Same API: `POST https://api.instantfundingtoday.net/api/applications`, JSON body with the same 31 keys
  (`legalBusinessName … contactConsent, sourcePage, honeypot`), success = `{ ok: true, submissionId }`.
- Same contact details (info@instantfundingtoday.net, (646) 807-8183) and the same disclaimers.

## Test locally (no production data)
    node test/mock-api.mjs &     # fake API on :8787
    node test/serve.mjs          # site on :4400
    open "http://localhost:4400/?api=http://localhost:8787"   # ?api= only works on localhost

## Before going live
1. Confirm the API sends CORS headers for `https://instantfundingtoday.net` (it must already, since the current site calls it).
2. Have counsel review the copy and `privacy/index.html`, and check state commercial-financing disclosure rules.
3. Deploy as static files (Cloudflare Pages reads `_headers` for the CSP and security headers).
4. Submit one real test ticket and confirm it reaches the CRM.
