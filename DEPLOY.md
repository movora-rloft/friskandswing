# Deploying Frisk & Swing (dev)

> **Status:** dev only. The site is **not** live on friskandswing.com.
> Current production: Google Sites.

## What's deployed where

| Environment | Where | URL | Status |
|---|---|---|---|
| Production | Google Sites | https://www.friskandswing.com | Live (untouched) |
| Dev branch | GitHub | https://github.com/movora-rloft/friskandswing/tree/dev | Pushed |
| Dev preview | Local | http://localhost:8765/ (run `python3 -m http.server`) | Running |
| Dev preview (planned) | Cloudflare Pages preview URL | _set up below_ | Not deployed yet |

## Run locally

```bash
cd /home/harry/friskandswing
python3 -m http.server 8765
# open http://localhost:8765/
```

## Set up a Cloudflare Pages preview (recommended, ~5 min)

This gives you a shareable URL like `friskandswing-dev.pages.dev` without touching DNS or production.

### One-time setup

1. **Sign in to Cloudflare** at https://dash.cloudflare.com (create a free account if you don't have one).
2. **Add Cloudflare account to GitHub**:
   - Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
   - Authorize Cloudflare to read the `movora-rloft/friskandswing` repo.
3. **Create the project**:
   - Project name: `friskandswing-dev` (or any name — this is the preview subdomain).
   - Production branch: **`dev`** (NOT `main`).
   - Build command: _leave empty_ (static site, no build).
   - Build output directory: **`/`** (root).
   - Environment variables: none needed.
4. **First deploy** will trigger on push to `dev`. Cloudflare will give you a URL like `https://friskandswing-dev.pages.dev`.
5. **Branch previews** are auto-on: every push to `dev` (or any branch) gets its own preview URL.

### After setup, every change flow

```bash
cd /home/harry/friskandswing
# edit files
git add -A
git commit -m "your message"
git push origin dev
# Cloudflare auto-deploys → new preview URL in 1-2 min
```

## When ready to go live (DO NOT do this without explicit approval)

1. Open PR from `dev` → `main` on GitHub.
2. Verify Cloudflare preview one more time.
3. In Cloudflare Pages project: switch **Production branch** to `main` for the live URL.
4. **DNS swap** (the only part that requires care):
   - Find the current `friskandswing.com` DNS records (where Google Sites is pointed).
   - Add Cloudflare Pages custom domain — Cloudflare will give you a CNAME target.
   - Change the apex `friskandswing.com` and `www` records to the new target.
   - **Keep any email MX records untouched** — these are independent of web hosting.
5. Wait 24-48h for DNS to propagate; keep the Google Site live during that window as a fallback.
6. Only after confirming the new site is reachable, take down the Google Site.

## Domain notes

- `friskandswing.com` is currently on Google Sites — **do not change DNS** until you've reviewed the Cloudflare preview and approved.
- Cloudflare Pages will issue a free `*.pages.dev` preview URL — no DNS change needed for that.
