// Set to true to allow unlimited voting (disable revote protection)
const ALLOW_REVOTE = true; // Set to true to deactivate the revote mechanism

const TABLE_BY_CATEGORY = {
  destination: "Destinations",
  activity: "Activities",
};

const LINK_FIELD_BY_CATEGORY = {
  destination: "destination",
  activity: "activity",
};

const ALREADY_VOTED_WARNING = "Un vote a déjà été enregistré avec cet appareil.";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Basic CORS handling (GitHub Pages)
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
        for (const vote of votes) {
          for (const category of Object.keys(LINK_FIELD_BY_CATEGORY)) {
            const optionId = getLinkedRecordId(vote.fields, category);
            if (!optionId) continue;
            counts[category][optionId] = (counts[category][optionId] || 0) + 1;
          }
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
        const voterName = typeof body.voterName === "string" ? body.voterName : undefined;
        const voteRecord = await getVoteByDeviceId(env, deviceId);
        const updates = {};

        if (body.destination) {
          const already = Boolean(getLinkedRecordId(voteRecord?.fields, "destination"));
          if (already && !ALLOW_REVOTE) {
            if (!warnings.includes(ALREADY_VOTED_WARNING)) {
              warnings.push(ALREADY_VOTED_WARNING);
            }
          } else {
            const destOptionId = await ensureOption(env, "destination", body.destination);
            updates[LINK_FIELD_BY_CATEGORY.destination] = [destOptionId];
          }
        }

        if (body.activity) {
          const already = Boolean(getLinkedRecordId(voteRecord?.fields, "activity"));
          if (already && !ALLOW_REVOTE) {
            if (!warnings.includes(ALREADY_VOTED_WARNING)) {
              warnings.push(ALREADY_VOTED_WARNING);
            }
          } else {
            const actOptionId = await ensureOption(env, "activity", body.activity);
            updates[LINK_FIELD_BY_CATEGORY.activity] = [actOptionId];
          }
        }

        if (!body.destination && !body.activity) {
          return cors(json({ error: "Aucun vote fourni" }, 400), env);
        }

        if (voterName) {
          updates.voterName = voterName;
        }

        if (Object.keys(updates).length > 0) {
          await upsertVoteByDeviceId(env, voteRecord, deviceId, updates);
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

async function getVoteByDeviceId(env, deviceId) {
  const formula = `{deviceId}="${escapeFormula(deviceId)}"`;
  const url = new URL(airtableBase(env, "Votes"));
  url.searchParams.set("maxRecords", "1");
  url.searchParams.set("filterByFormula", formula);

  const data = await airtableFetch(env, url.toString());
  return data.records?.[0] || null;
}

async function ensureOption(env, category, option) {
  const table = TABLE_BY_CATEGORY[category];
  if (!table) throw new Error(`${category}: categorie invalide`);

  if (option.type === "existing") {
    const id = String(option.id || "").trim();
    if (!id) throw new Error(`${category}: id manquant`);

    // Enforce referential integrity against the category-specific table.
    await getOptionById(env, table, id);
    return id;
  }

  if (option.type === "new") {
    const name = String(option.name || "").trim();
    if (name.length < 2) throw new Error(`${category}: nom trop court`);

    // Optional dedup: if same name exists, reuse it.
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

async function getOptionById(env, table, id) {
  const recordUrl = `${airtableBase(env, table)}/${encodeURIComponent(id)}`;
  return airtableFetch(env, recordUrl);
}

async function upsertVoteByDeviceId(env, voteRecord, deviceId, fields) {
  if (voteRecord?.id) {
    const recordUrl = `${airtableBase(env, "Votes")}/${encodeURIComponent(voteRecord.id)}`;
    await airtableFetch(env, recordUrl, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    return;
  }

  await airtableFetch(env, airtableBase(env, "Votes"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ records: [{ fields: { deviceId, ...fields } }] }),
  });
}

function getLinkedRecordId(fields, category) {
  const linkField = LINK_FIELD_BY_CATEGORY[category];
  const links = fields?.[linkField];
  if (!Array.isArray(links) || links.length === 0) return null;
  return typeof links[0] === "string" && links[0] ? links[0] : null;
}

function escapeFormula(s) {
  return String(s).replaceAll('"', '\\"');
}

function toRankedPercent(options, countsById) {
  const optionIds = new Set(options.map((o) => o.id));
  const orphanVotes = Object.entries(countsById).reduce((acc, [id, count]) => {
    return optionIds.has(id) ? acc : acc + count;
  }, 0);

  const rows = options
    .map((o) => {
      const c = countsById[o.id] || 0;
      return { id: o.id, name: o.name, count: c };
    })
    .sort((a, b) => b.count - a.count);

  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const rowsWithPercent = rows.map((r) => {
    const pct = total ? Math.round((r.count / total) * 100) : 0;
    return { ...r, percent: pct };
  });

  return { total, orphanVotes, rows: rowsWithPercent };
}
