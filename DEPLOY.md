# Production Cutover — friskandswing.com → Cloudflare Pages

## Status (as of 2026-09-04)

- `dev` branch is the production branch in Cloudflare Pages
- `friskandswing.pages.dev` is live and serving the new site
- `www.friskandswing.com` and `friskandswing.com` still point at Google Sites
- DNS for `friskandswing.com` is at the domain registrar (you own this — not in this repo)

## When to run this

Run this when **all** of these are true:

1. The site has been on `pages.dev` for at least 1 week with no broken forms / schedule refreshes
2. The studio owner has successfully updated the schedule sheet at least once (proves the Sheet → Worker → Cache flow works for non-developers)
3. You're okay with a 0–48h window where some visitors see the new site and some still see Google Sites (this is normal DNS propagation; you can't avoid it)

## What's at stake

- **Reversible**: yes, in two ways. (1) Re-point DNS back to Google Sites at your registrar; takes another 0–48h to propagate. (2) Cloudflare Pages never touches the Google Site — you can delete Google Sites whenever you're confident the new site is stable.
- **SEO impact**: minimal if done within 1 week of going live. Google indexes both URLs during propagation; once stable, `friskandswing.com` will rank as it did before (with new content). Do NOT delete the Google Site until 1 week after cutover — Google needs that time to re-crawl.
- **Downtime**: zero. Both sites stay live simultaneously during the swap. Visitors on old DNS see Google Sites; visitors on new DNS see Cloudflare Pages.

## Pre-flight checklist (run through this the morning of)

- [ ] You are logged into Cloudflare dashboard with access to both `friskandswing.com` (DNS) and `friskandswing` Pages project
- [ ] You know the login for the domain registrar (where you bought `friskandswing.com`)
- [ ] Current `dev` branch on GitHub is the version you want live (check `https://friskandswing.pages.dev` matches your latest approved state)
- [ ] Service account JSON is set in both Preview AND Production envs on Cloudflare Pages (already done)
- [ ] KV namespace `SCHEDULE_CACHE` is bound in Production env (already done)
- [ ] You have a test WhatsApp number ready to submit a trial form after cutover
- [ ] You can take screenshots of both before/after for the studio owner

## Cutover steps

### A. Add the custom domain in Cloudflare Pages

1. Go to **Cloudflare Dashboard → Workers & Pages → friskandswing → Settings → Custom domains**
2. Click **Set up a custom domain**
3. Enter `friskandswing.com` → Cloudflare will check DNS. Two outcomes:
   - **"Domain is on Cloudflare"** → it shows the records you need to add. Continue to step B.
   - **"Domain is not on Cloudflare"** → Cloudflare will give you a target CNAME like `friskandswing.pages.dev`. You need to add this at your registrar manually. Skip to step B-alt.
4. Also add `www.friskandswing.com` the same way. Cloudflare auto-issues an SSL cert for both within 60 seconds.

### B. (If on Cloudflare) Confirm DNS records

1. Go to **Cloudflare Dashboard → Websites → friskandswing.com → DNS → Records**
2. Verify you have records for both `friskandswing.com` (root) and `www.friskandswing.com` pointing at the Pages project. Cloudflare usually adds these automatically when you attach the custom domain. If missing:
   - `friskandswing.com` → CNAME to `friskandswing.pages.dev` (Cloudflare supports CNAME-at-root via CNAME flattening)
   - `www.friskandswing.com` → CNAME to `friskandswing.pages.dev`
3. Both records should be **proxied** (orange cloud icon) — this lets Cloudflare handle SSL.

### B-alt. (If at a third-party registrar) Add CNAMEs at the registrar

1. Log in to your registrar (Namecheap / GoDaddy / Google Domains)
2. Go to DNS settings for `friskandswing.com`
3. Add or edit:
   - Host `www`, Type `CNAME`, Value `friskandswing.pages.dev.`
   - Host `@` (or `friskandswing.com`), Type `CNAME`, Value `friskandswing.pages.dev.` — only works if your registrar supports CNAME-at-root. If not, use the **URL redirect** feature to point `friskandswing.com` → `www.friskandswing.com` (301 redirect).
4. Save. DNS propagation: 5 minutes to 48 hours. Most users see the change within 1 hour.

### C. Verify SSL

1. In Cloudflare Pages → **Custom domains** → both domains should show **"Active"** status with a green SSL checkmark.
2. Open **https://friskandswing.com** in an incognito browser tab (this bypasses any cached DNS resolution). If you see the new site, SSL is working.

### D. Test the production site

Walk through these one by one. Take notes if anything breaks.

- [ ] `https://friskandswing.com` loads the new site (hero, schedule, instructors, all sections)
- [ ] `https://www.friskandswing.com` redirects to (or loads the same as) `friskandswing.com`
- [ ] `https://friskandswing.com/api/schedule?refresh=1` returns JSON with `"ok": true`
- [ ] Submit the trial form on `https://friskandswing.com/#trial` with your test number → confirm a row appears in the Google Sheet within 30 seconds
- [ ] Open the page on your phone — verify mobile menu, schedule cards, reviews section
- [ ] Click a schedule class → confirm it smooth-scrolls to the form and pre-selects the dance
- [ ] Share the URL on WhatsApp → confirm the OG image preview renders with the brand image

### E. Watch for 48 hours

DNS propagation is global. Some ISPs cache aggressively (TTL-based). During this window:
- Some visitors will hit the new site (Cloudflare Pages)
- Some will still hit the old site (Google Sites)

This is normal and expected. Don't panic.

What to monitor:
- Cloudflare Pages → **friskandswing → Analytics** → check request count, error rate, country distribution
- Google Sites → **Analytics** → should show declining traffic as DNS flips
- WhatsApp / Instagram DMs → if anyone reports the site looking weird, ask which URL and what device

### F. Take down Google Sites (1 week later, not before)

After 1 week of stable Cloudflare Pages traffic:

1. Open Google Sites → **friskandswing.com**
2. Click **Share → Manage sharing** → confirm the site is no longer needed
3. **Don't delete immediately.** First, change the Google Site's visibility to **unpublished** (private). This hides it from any late DNS-propagating visitors without permanent destruction.
4. Wait 48 more hours. If no complaints, delete the Google Site entirely.

### G. Set `main` as the production branch (optional but recommended)

Right now `dev` IS the production branch. For long-term hygiene, switch to `main`:

1. GitHub → **movora-rloft/friskandswing → Settings → Branches → Default branch** → change to `main`
2. Cloudflare Pages → **friskandswing → Settings → Builds → Branch control** → set Production branch to `main`
3. From now on, you develop on `dev` and merge to `main` when ready to deploy.

## Rollback (if something goes wrong)

If during the 48h watch window something is critically broken (form doesn't work, schedule is wrong, payment-related):

1. **Revert DNS** at your registrar back to Google Sites
2. Wait 0-48h for DNS to propagate back
3. Fix the bug in Cloudflare Pages
4. Try the cutover again

Cloudflare Pages itself has its own rollback — go to **Deployments → click an older deploy → "Rollback to this deploy"**. This reverts the site code instantly without touching DNS. Use this for content fixes; use DNS revert for critical failures.

## After cutover — quick wins

Once the site is live for 1-2 weeks:

- [ ] Delete `preview/` folder and `_review.html` from the repo (saves 5MB per deploy)
- [ ] Add a Cloudflare Worker free email alert for 5xx error spikes
- [ ] Set up a monthly calendar reminder to refresh `https://friskandswing.com/api/schedule?refresh=1` after the studio owner edits the sheet
- [ ] (Optional) Add Google Search Console for `friskandswing.com` to monitor SEO
- [ ] (Optional) Add the `DanceSchool` schema.org structured data for richer search results
- [ ] (Optional) Add a `/_health` endpoint to Cloudflare Pages that returns 200 if the Worker can reach Google Sheets

## Contact for help

If anything breaks during cutover, check in order:
1. Cloudflare Pages deployment logs (Dashboard → Workers & Pages → friskandswing → Logs)
2. Cloudflare Pages functions logs (Logs → Filter by `/api/trial` or `/api/schedule`)
3. Google Cloud Console → IAM → Service Accounts → friskandswing-worker → verify key still works
4. Google Sheets → share settings → confirm service account still has Editor access
5. Domain registrar → DNS records → confirm they're still pointing where you set them

If still stuck: take a screenshot of the failure (URL, error message, browser console output), send to whoever is helping you debug.
