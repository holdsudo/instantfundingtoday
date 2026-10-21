# Instant Funding Today

Static site, zero dependencies, served by GitHub Pages at https://instantfundingtoday.net.

- `index.html`, `privacy/index.html`, `assets/` — the site. Identity: ink green, ivory, brass hairlines, engraved rosette (`assets/rosette.svg`).
- `worker/` — the intake API (Cloudflare Worker `ift-intake`, D1 database `ift-applications`), served at `api.instantfundingtoday.net/api/applications`. `worker/schema.sql` is the table.
- No inline scripts or styles (the CSP in `_headers` applies on Cloudflare Pages/Netlify; GitHub Pages ignores it).
- `test/` — local mock API (:8787) and static server (:4400). Run both and open `http://localhost:4400/?api=http://localhost:8787` (the `?api=` override is honoured on localhost only).

Reading applications: Cloudflare dashboard → Storage & databases → D1 → `ift-applications` → `applications`.
