export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS simple (GitHub Pages)
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }), env);
    }

    try {
      if (url.pathname === "/api/options" && request.method === "GET") {
        const [dest, act] = await Promise.all([
          listOptions(env, "Destinations"),
          listOptions(env, "Activities"),
        ]);
        return cors(json({ destinations: dest, activities: act }), env);
      }

      if (url.pathname === "/api/results" && request.method === "GET") {
        const votes = await listVotes(env);

        const counts = { destination: {}, activity: {} };
        for (const v of votes) {
          const cat = v.fields.category;
          const opt = v.fields.optionId;
          if (!cat || !opt) continue;
          if (!counts[cat]) continue;
          counts[cat][opt] = (counts[cat][opt] || 0) + 1;
        }

        const [dest, act] = await Promise.all([
          listOptions(env, "Destinations"),
          listOptions(env, "Activities"),
        ]);

        return cors(
          json({
            destination: toRankedPercent(dest, counts.destination),
            activity: toRankedPercent(act, counts.activity),
          }),
          env
        );
      }

      if (url.pathname === "/api/vote" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body?.deviceId) {
          return cors(json({ error: "deviceId manquant" }, 400), env);
        }

        const deviceId = String(body.deviceId);
        const warnings = [];

        // Mode 2: on traite destination ET/OU activity si présents
        // Anti-doublon: 1 vote max par deviceId + category

        // Pass voterName to createVote if present
        const voterName = typeof body.voterName === 'string' ? body.voterName : undefined;

        if (body.destination) {
          const already = await hasVoted(env, "destination", deviceId);
          if (already) {
            warnings.push("Destination: déjà voté pour cet appareil.");
          } else {
            const destOptionId = await ensureOption(env, "destination", body.destination);
            await createVote(env, "destination", destOptionId, deviceId, voterName);
          }
        }

        if (body.activity) {
          const already = await hasVoted(env, "activity", deviceId);
          if (already) {
            warnings.push("Activité: déjà voté pour cet appareil.");
          } else {
            const actOptionId = await ensureOption(env, "activity", body.activity);
            await createVote(env, "activity", actOptionId, deviceId, voterName);
          }
        }

        if (!body.destination && !body.activity) {
          return cors(json({ error: "Aucun vote fourni" }, 400), env);
        }

        return cors(json({ ok: true, warnings }), env);
      }

      return cors(new Response("Not found", { status: 404 }), env);
    } catch (e) {
      return cors(json({ error: e?.message || "Erreur serveur" }, 500), env);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function cors(res, env) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", env.CORS_ORIGIN || "*");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type");
  return new Response(res.body, { status: res.status, headers: h });
}

/** Airtable helpers **/

function airtableBase(env, table) {
  return `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`;
}

async function airtableFetch(env, url, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Airtable ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function listOptions(env, table) {
  const data = await airtableFetch(env, airtableBase(env, table));
  return data.records.map((r) => ({ id: r.id, name: r.fields.name }));
}

async function listVotes(env) {
  const data = await airtableFetch(env, airtableBase(env, "Votes"));
  return data.records.map((r) => ({ id: r.id, fields: r.fields }));
}

async function hasVoted(env, category, deviceId) {
  // filterByFormula: AND({category}="destination",{deviceId}="xxx")
  const formula = `AND({category}="${escapeFormula(category)}",{deviceId}="${escapeFormula(
    deviceId
  )}")`;
  const url = new URL(airtableBase(env, "Votes"));
  url.searchParams.set("maxRecords", "1");
  url.searchParams.set("filterByFormula", formula);

  const data = await airtableFetch(env, url.toString());
  return (data.records?.length || 0) > 0;
}

async function ensureOption(env, category, option) {
  const table = category === "destination" ? "Destinations" : "Activities";

  if (option.type === "existing") {
    if (!option.id) throw new Error(`${category}: id manquant`);
    return option.id;
  }

  if (option.type === "new") {
    const name = String(option.name || "").trim();
    if (name.length < 2) throw new Error(`${category}: nom trop court`);

    // Optionnel: déduplication (si nom existe déjà, on réutilise)
    const existingId = await findOptionByName(env, table, name);
    if (existingId) return existingId;

    const created = await airtableFetch(env, airtableBase(env, table), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ records: [{ fields: { name } }] }),
    });
    return created.records[0].id;
  }

  throw new Error(`${category}: type invalide`);
}

async function findOptionByName(env, table, name) {
  const formula = `{name}="${escapeFormula(name)}"`;
  const url = new URL(airtableBase(env, table));
  url.searchParams.set("maxRecords", "1");
  url.searchParams.set("filterByFormula", formula);
  const data = await airtableFetch(env, url.toString());
  return data.records?.[0]?.id || null;
}

async function createVote(env, category, optionId, deviceId, voterName) {
  const fields = { category, optionId, deviceId };
  if (voterName) fields.voterName = voterName;
  await airtableFetch(env, airtableBase(env, "Votes"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      records: [{ fields }],
    }),
  });
}

function escapeFormula(s) {
  // très simple pour éviter de casser les guillemets dans filterByFormula
  return String(s).replaceAll('"', '\\"');
}

function toRankedPercent(options, countsById) {
  const total = Object.values(countsById).reduce((a, b) => a + b, 0) || 0;

  const rows = options
    .map((o) => {
      const c = countsById[o.id] || 0;
      const pct = total ? Math.round((c / total) * 100) : 0;
      return { id: o.id, name: o.name, count: c, percent: pct };
    })
    .sort((a, b) => b.count - a.count);

  // Ajustement optionnel pour que la somme fasse exactement 100 (à cause des arrondis)
  // Ici on laisse simple : c’est ok pour une démo.

  return { total, rows };
}
