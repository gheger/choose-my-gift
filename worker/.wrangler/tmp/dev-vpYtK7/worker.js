var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-4mWRFk/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/worker.js
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }), env);
    }
    try {
      if (url.pathname === "/api/options" && request.method === "GET") {
        const [dest, act] = await Promise.all([
          listOptions(env, "Destinations"),
          listOptions(env, "Activities")
        ]);
        return cors(json({ destinations: dest, activities: act }), env);
      }
      if (url.pathname === "/api/results" && request.method === "GET") {
        const votes = await listVotes(env);
        const counts = { destination: {}, activity: {} };
        for (const v of votes) {
          const cat = v.fields.category;
          const opt = v.fields.optionId;
          if (!cat || !opt)
            continue;
          if (!counts[cat])
            continue;
          counts[cat][opt] = (counts[cat][opt] || 0) + 1;
        }
        const [dest, act] = await Promise.all([
          listOptions(env, "Destinations"),
          listOptions(env, "Activities")
        ]);
        return cors(
          json({
            destination: toRankedPercent(dest, counts.destination),
            activity: toRankedPercent(act, counts.activity)
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
        if (body.destination) {
          const already = await hasVoted(env, "destination", deviceId);
          if (already) {
            warnings.push("Destination: d\xE9j\xE0 vot\xE9 pour cet appareil.");
          } else {
            const destOptionId = await ensureOption(env, "destination", body.destination);
            await createVote(env, "destination", destOptionId, deviceId);
          }
        }
        if (body.activity) {
          const already = await hasVoted(env, "activity", deviceId);
          if (already) {
            warnings.push("Activit\xE9: d\xE9j\xE0 vot\xE9 pour cet appareil.");
          } else {
            const actOptionId = await ensureOption(env, "activity", body.activity);
            await createVote(env, "activity", actOptionId, deviceId);
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
  }
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(json, "json");
function cors(res, env) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", env.CORS_ORIGIN || "*");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type");
  return new Response(res.body, { status: res.status, headers: h });
}
__name(cors, "cors");
function airtableBase(env, table) {
  return `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`;
}
__name(airtableBase, "airtableBase");
async function airtableFetch(env, url, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
      ...init?.headers || {}
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Airtable ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}
__name(airtableFetch, "airtableFetch");
async function listOptions(env, table) {
  const data = await airtableFetch(env, airtableBase(env, table));
  return data.records.map((r) => ({ id: r.id, name: r.fields.name }));
}
__name(listOptions, "listOptions");
async function listVotes(env) {
  const data = await airtableFetch(env, airtableBase(env, "Votes"));
  return data.records.map((r) => ({ id: r.id, fields: r.fields }));
}
__name(listVotes, "listVotes");
async function hasVoted(env, category, deviceId) {
  const formula = `AND({category}="${escapeFormula(category)}",{deviceId}="${escapeFormula(
    deviceId
  )}")`;
  const url = new URL(airtableBase(env, "Votes"));
  url.searchParams.set("maxRecords", "1");
  url.searchParams.set("filterByFormula", formula);
  const data = await airtableFetch(env, url.toString());
  return (data.records?.length || 0) > 0;
}
__name(hasVoted, "hasVoted");
async function ensureOption(env, category, option) {
  const table = category === "destination" ? "Destinations" : "Activities";
  if (option.type === "existing") {
    if (!option.id)
      throw new Error(`${category}: id manquant`);
    return option.id;
  }
  if (option.type === "new") {
    const name = String(option.name || "").trim();
    if (name.length < 2)
      throw new Error(`${category}: nom trop court`);
    const existingId = await findOptionByName(env, table, name);
    if (existingId)
      return existingId;
    const created = await airtableFetch(env, airtableBase(env, table), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ records: [{ fields: { name } }] })
    });
    return created.records[0].id;
  }
  throw new Error(`${category}: type invalide`);
}
__name(ensureOption, "ensureOption");
async function findOptionByName(env, table, name) {
  const formula = `{name}="${escapeFormula(name)}"`;
  const url = new URL(airtableBase(env, table));
  url.searchParams.set("maxRecords", "1");
  url.searchParams.set("filterByFormula", formula);
  const data = await airtableFetch(env, url.toString());
  return data.records?.[0]?.id || null;
}
__name(findOptionByName, "findOptionByName");
async function createVote(env, category, optionId, deviceId) {
  await airtableFetch(env, airtableBase(env, "Votes"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      records: [{ fields: { category, optionId, deviceId } }]
    })
  });
}
__name(createVote, "createVote");
function escapeFormula(s) {
  return String(s).replaceAll('"', '\\"');
}
__name(escapeFormula, "escapeFormula");
function toRankedPercent(options, countsById) {
  const total = Object.values(countsById).reduce((a, b) => a + b, 0) || 0;
  const rows = options.map((o) => {
    const c = countsById[o.id] || 0;
    const pct = total ? Math.round(c / total * 100) : 0;
    return { id: o.id, name: o.name, count: c, percent: pct };
  }).sort((a, b) => b.count - a.count);
  return { total, rows };
}
__name(toRankedPercent, "toRankedPercent");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-4mWRFk/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-4mWRFk/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
