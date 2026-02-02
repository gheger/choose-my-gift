const API_BASE = import.meta.env.VITE_API_BASE;

async function handle(r) {
  if (r.ok) return r.json();
  let msg = "Erreur";
  try {
    const j = await r.json();
    msg = j?.error || msg;
  } catch {}
  const e = new Error(msg);
  e.status = r.status;
  throw e;
}

export function getOptions() {
  return fetch(`${API_BASE}/api/options`).then(handle);
}

export function getResults() {
  return fetch(`${API_BASE}/api/results`).then(handle);
}

export function submitVote(payload) {
  return fetch(`${API_BASE}/api/vote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle);
}
