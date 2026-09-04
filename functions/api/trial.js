// Frisk & Swing — trial form handler
// Lives at /api/trial on the Cloudflare Pages site.
// Validates the payload, then writes a row to the studio's Google Sheet via
// the Sheets API using a service account. The service-account JSON is bound
// as the secret env var GOOGLE_SERVICE_ACCOUNT_JSON in the Cloudflare dashboard
// (Settings -> Functions -> Environment variables). The sheet ID is
// GOOGLE_SHEET_ID (same place).
//
// Sheet columns (header row, row 1): Timestamp | Name | WhatsApp | Dance |
// Experience | Preferred Day | Consent | Source | User Agent
// The Worker appends to the next empty row. If the sheet is empty, it writes
// the header first.

const SHEET_RANGE = "A1:I1"; // we'll append after row 1 anyway

const RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 10 };
// 10 submissions per IP per hour. Real users won't hit this; bots will.

const HEADERS = [
  "Timestamp", "Name", "WhatsApp", "Dance",
  "Experience", "Preferred Day", "Consent", "Source", "User Agent"
];

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });

const ok    = (msg = "ok")    => json({ ok: true,  message: msg });
const bad   = (msg, code = 400, origin) => json({ ok: false, error: msg }, { status: code, headers: allow(origin) });
const allow = (origin) => ({
  "access-control-allow-origin": origin || "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "vary": "Origin",
});

function clientIp(request, ctx) {
  return (
    request.headers.get("cf-connecting-ip") ||
    (ctx && ctx.waitUntil ? null : null) ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function rateLimit(env, ip) {
  // Use the Workers KV namespace TRIAL_RATE_LIMIT if bound. Otherwise, soft-allow.
  if (!env.TRIAL_RATE_LIMIT) return { allowed: true, count: 0 };
  const key = `ip:${ip}`;
  const now = Date.now();
  const raw = await env.TRIAL_RATE_LIMIT.get(key);
  const data = raw ? JSON.parse(raw) : { count: 0, resetAt: now + RATE_LIMIT.windowMs };
  if (now > data.resetAt) { data.count = 0; data.resetAt = now + RATE_LIMIT.windowMs; }
  data.count += 1;
  await env.TRIAL_RATE_LIMIT.put(key, JSON.stringify(data), { expirationTtl: 3700 });
  return { allowed: data.count <= RATE_LIMIT.max, count: data.count };
}

function b64ToBytes(b64) {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function pemToArrayBuffer(pem) {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  return b64ToBytes(body).buffer;
}

async function importPrivateKey(pem) {
  return crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function base64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function makeJwt(serviceAccount) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = (o) => base64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const key = await importPrivateKey(serviceAccount.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${base64url(new Uint8Array(sig))}`;
}

async function getAccessToken(serviceAccount) {
  const jwt = await makeJwt(serviceAccount);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`token exchange ${r.status}: ${await r.text()}`);
  const { access_token } = await r.json();
  return access_token;
}

async function ensureHeaderAndAppend(env, token, row) {
  // 1) Read the first row. If empty, write the header.
  const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/A1:I1`;
  const r1 = await fetch(readUrl, { headers: { authorization: `Bearer ${token}` } });
  const j1 = await r1.json();
  const hasHeader = (j1.values && j1.values[0] && j1.values[0].length) ? true : false;
  if (!hasHeader) {
    const u1 = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/A1:I1?valueInputOption=USER_ENTERED`;
    const r2 = await fetch(u1, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ range: "A1:I1", majorDimension: "ROWS", values: [HEADERS] }),
    });
    if (!r2.ok) throw new Error(`header write ${r2.status}: ${await r2.text()}`);
  }
  // 2) Append via the values.append endpoint. Pass the full range A1:I1
  //    so the API knows which sheet/columns to use; the API ignores the
  //    row index and inserts after the last non-empty row.
  const appendUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/A1:I1:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const r3 = await fetch(appendUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ range: "A1:I1", majorDimension: "ROWS", values: [row] }),
  });
  if (!r3.ok) throw new Error(`append ${r3.status}: ${await r3.text()}`);
  return await r3.json();
}

function validPhone(s) {
  return (s || "").replace(/\D/g, "").length >= 7;
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("origin") || "";
  let body;
  try { body = await request.json(); }
  catch { return bad("Invalid JSON.", 400, origin); }

  // honeypot: silently accept and discard
  if (body && typeof body.company === "string" && body.company.trim() !== "") {
    return ok();
  }

  const { name, whatsapp, dance, experience = "", day = "", consent = false } = body || {};
  if (!name || typeof name !== "string" || name.length > 80)        return bad("Name is required.", 400, origin);
  if (!whatsapp || typeof whatsapp !== "string" || !validPhone(whatsapp))
                                                                       return bad("Valid WhatsApp number is required.", 400, origin);
  if (!dance || !["Salsa","Bachata","Zouk","Not sure yet"].includes(dance))
                                                                       return bad("Pick a valid style.", 400, origin);
  if (consent !== true)                                              return bad("Consent is required.", 400, origin);

  const ip = clientIp(request);
  const rl = await rateLimit(env, ip);
  if (!rl.allowed) return bad("Too many submissions. Try again later.", 429, origin);

  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) return json({ ok: false, error: "Server is not configured yet.", detail: "GOOGLE_SERVICE_ACCOUNT_JSON missing" }, { status: 503, headers: allow(origin) });
  if (!env.GOOGLE_SHEET_ID)              return json({ ok: false, error: "Server is not configured yet.", detail: "GOOGLE_SHEET_ID missing" }, { status: 503, headers: allow(origin) });

  let sa;
  try { sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON); }
  catch { return bad("Server config error.", 500, origin); }

  const row = [
    new Date().toISOString(),
    name.trim(),
    whatsapp.trim(),
    dance,
    experience || "",
    day || "",
    "Yes",
    body.referrer || "",
    body.ua || ""
  ];

  try {
    const token = await getAccessToken(sa);
    await ensureHeaderAndAppend(env, token, row);
  } catch (e) {
    return json({ ok: false, error: "Sheet write failed.", detail: String(e) }, { status: 500, headers: allow(origin) });
  }

  return ok("We'll WhatsApp you within 24 hours to confirm your spot.");
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: allow(request.headers.get("origin")) });
}
