/* Frisk & Swing — /api/schedule
 *
 * Returns the weekly class schedule as JSON, sourced from a private Google
 * Sheet and cached in Cloudflare KV.
 *
 *   GET /api/schedule            -> latest cached snapshot
 *   GET /api/schedule?refresh=1  -> force re-fetch from the sheet, update cache
 *
 * Response shape:
 *   {
 *     ok: true,
 *     source: "cache" | "sheet",
 *     cachedAt: <ISO8601>,
 *     updatedAt: <ISO8601 | null>,   // last edit timestamp from the sheet
 *     days: [
 *       { day: "Mon", items: [{time, style, name, level, room, instructors}, ...] },
 *       ...
 *     ],
 *     genres: ["Salsa", "Bachata", "Zouk", "Kizomba"]
 *   }
 *
 * The KV key is `schedule:v1` (bump the suffix to invalidate all caches after
 * a breaking change to the response shape).
 */

const CACHE_KEY = "schedule:v1";
const SHEET_ID  = "1Dr7Hi2lNccWlZhSZ51Hak4yMe2npT47LhaGHgfF74PM";
const SHEET_TAB = "Sheet1"; // first/default tab name

// Normalise a "Day" cell into the 3-letter code we render with.
const DAY_MAP = {
  Monday: "Mon", Mon: "Mon",
  Tuesday: "Tue", Tue: "Tue",
  Wednesday: "Wed", Wed: "Wed",
  Thursday: "Thu", Thu: "Thu",
  Friday: "Fri", Fri: "Fri",
  Saturday: "Sat", Sat: "Sat", "Sat / Sun": "Sat",
  Sunday: "Sun", Sun: "Sun",
};
const DAY_ORDER = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

// Map raw sheet rows into the shape the page renders.
function rowsToSchedule(rows) {
  // Skip header row.
  const data = rows.slice(1);
  const byDay = new Map();
  for (const r of data) {
    const [dayRaw, time, genre, name, level, room, instructors = "", activeRaw = "1"] = r;
    if (String(activeRaw).trim() === "0") continue;            // hidden
    if (!dayRaw || !time || !genre || !name) continue;          // incomplete
    const day = DAY_MAP[dayRaw.trim()] || dayRaw.trim();
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push({
      time:        time.trim(),
      style:       genre.trim().toLowerCase(),   // lowercase so data-filter values match
      name:        name.trim(),
      level:       (level || "all").trim().toLowerCase(),
      room:        (room || "").replace(/^Studio\s+/i, "").trim(),
      instructors: instructors.trim(),
    });
  }
  // Sort days and items within each day by start time.
  const days = [...byDay.entries()]
    .sort((a, b) => (DAY_ORDER[a[0]] ?? 99) - (DAY_ORDER[b[0]] ?? 99))
    .map(([day, items]) => ({
      day,
      items: items.sort((a, b) => a.time.localeCompare(b.time)),
    }));
  // Distinct genres in render order.
  const genres = [...new Set(days.flatMap(d => d.items.map(i => i.style)))];
  return { days, genres };
}

// --- Google Sheets API ---
function b64url(input) {
  // input can be a string or a Uint8Array
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGoogleAccessToken(env) {
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;

  // Import the PEM private key as PKCS#8 for SubtleCrypto.
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${b64url(new Uint8Array(sig))}`;

  const tokRes = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!tokRes.ok) throw new Error(`token ${tokRes.status}: ${await tokRes.text()}`);
  return (await tokRes.json()).access_token;
}

async function fetchSheet(env) {
  const token = await getGoogleAccessToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_TAB)}!A1:I200`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`sheets ${r.status}: ${body.slice(0,200)}`);
  }
  const j = await r.json();
  return { values: j.values || [], updatedAt: j.updatedAt || null };
}

// --- HTTP handler ---
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  // CORS so the page can call this directly from the browser if ever needed.
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=300",  // 5 min browser cache as a safety net
  };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!env.SCHEDULE_CACHE) {
    return new Response(JSON.stringify({ ok: false, error: "KV binding SCHEDULE_CACHE not configured" }), {
      status: 503, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let payload = null;
  if (!forceRefresh) {
    const cached = await env.SCHEDULE_CACHE.get(CACHE_KEY, { type: "json" });
    if (cached && cached.ok) payload = { ...cached, source: "cache" };
  }

  if (!payload) {
    try {
      const { values, updatedAt } = await fetchSheet(env);
      const { days, genres } = rowsToSchedule(values);
      const fresh = {
        ok: true,
        source: "sheet",
        cachedAt: new Date().toISOString(),
        updatedAt,
        days,
        genres,
      };
      // Cache for 12 hours — refresh URL is the manual override.
      await env.SCHEDULE_CACHE.put(CACHE_KEY, JSON.stringify(fresh), { expirationTtl: 43200 });
      payload = fresh;
    } catch (err) {
      // Fall back to whatever's in cache, even if expired — resilience over freshness.
      const stale = await env.SCHEDULE_CACHE.get(CACHE_KEY, { type: "json" });
      if (stale && stale.ok) {
        payload = { ...stale, source: "cache-stale", warning: String(err.message || err) };
      } else {
        return new Response(JSON.stringify({ ok: false, error: String(err.message || err) }), {
          status: 502, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }
  }

  return new Response(JSON.stringify(payload), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
