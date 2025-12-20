// scripts/set_featured_poll.mjs
// Recalcula a poll featured com base em:
// - status = 'open'
// - participantes únicos (distinct user_hash) nas últimas 24h
// Atualiza polls.is_featured (deixa apenas 1 true)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function iso24hAgo() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString();
}

async function sb(path, { method = "GET", body } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${url} -> ${res.status}: ${text}`);
  }

  // Para DELETE/UPDATE pode vir vazio; mas preferimos return=representation
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return null;
}

async function main() {
  const since = iso24hAgo();

  // 1) Buscar polls abertas (candidatas)
  const openPolls = await sb(
    `polls?select=id,created_at&status=eq.open&order=created_at.desc`
  );

  if (!Array.isArray(openPolls) || openPolls.length === 0) {
    console.log("No open polls found. Setting all is_featured=false.");
    await sb(`polls?is_featured=eq.true`, { method: "PATCH", body: { is_featured: false } });
    return;
  }

  const pollIds = openPolls.map((p) => p.id);

  // 2) Buscar votos das últimas 24h dessas polls
  // Pegamos poll_id e user_hash e contamos distinct no Node (simples e robusto).
  const votes = await sb(
    `votes?select=poll_id,user_hash&created_at=gte.${encodeURIComponent(
      since
    )}&poll_id=in.(${pollIds.join(",")})`
  );

  const distinctByPoll = new Map();
  for (const v of votes || []) {
    if (!v?.poll_id || !v?.user_hash) continue;
    if (!distinctByPoll.has(v.poll_id)) distinctByPoll.set(v.poll_id, new Set());
    distinctByPoll.get(v.poll_id).add(v.user_hash);
  }

  // 3) Escolher winner: maior distinct; em empate, mais recente (openPolls já está desc)
  let winnerId = null;
  let winnerScore = -1;

  for (const p of openPolls) {
    const score = distinctByPoll.get(p.id)?.size || 0;
    if (score > winnerScore) {
      winnerScore = score;
      winnerId = p.id;
    }
  }

  // Se todo mundo tiver 0, winner será a mais recente (porque winnerScore inicia -1 e percorre em order desc)
  if (!winnerId) winnerId = openPolls[0].id;

  console.log(`Featured poll selected: ${winnerId} (unique participants last 24h: ${winnerScore})`);

  // 4) Atualizar featured (deixar apenas uma true)
  await sb(`polls?is_featured=eq.true`, { method: "PATCH", body: { is_featured: false } });
  await sb(`polls?id=eq.${winnerId}`, { method: "PATCH", body: { is_featured: true } });

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
