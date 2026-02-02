import React, { useEffect, useMemo, useState } from "react";
import { getOptions, submitVote } from "../lib/api.js";
import { getOrCreateDeviceId } from "../lib/device.js";

export default function VotePage() {
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(false);

  // destination
  const [destMode, setDestMode] = useState("existing"); // existing | new
  const [destId, setDestId] = useState("");
  const [destNew, setDestNew] = useState("");

  // activity
  const [actMode, setActMode] = useState("existing"); // existing | new
  const [actId, setActId] = useState("");
  const [actNew, setActNew] = useState("");

  const [message, setMessage] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const o = await getOptions();
        if (!alive) return;
        setOptions(o);
        // pré-sélection si possible
        if (o.destinations?.[0]?.id) setDestId(o.destinations[0].id);
        if (o.activities?.[0]?.id) setActId(o.activities[0].id);
      } catch (e) {
        setMessage({ type: "error", text: "Impossible de charger les options." });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const canSubmit = useMemo(() => {
    const hasDest =
      (destMode === "existing" && !!destId) ||
      (destMode === "new" && destNew.trim().length >= 2);

    const hasAct =
      (actMode === "existing" && !!actId) ||
      (actMode === "new" && actNew.trim().length >= 2);

    // Mode 2: au moins un des deux
    return hasDest || hasAct;
  }, [destMode, destId, destNew, actMode, actId, actNew]);

  async function onSubmit() {
    setMessage(null);
    setLoading(true);
    try {
      const payload = { deviceId };

      // destination (optionnel)
      const hasDest =
        (destMode === "existing" && !!destId) ||
        (destMode === "new" && destNew.trim().length >= 2);

      if (hasDest) {
        payload.destination =
          destMode === "existing"
            ? { type: "existing", id: destId }
            : { type: "new", name: destNew.trim() };
      }

      // activity (optionnel)
      const hasAct =
        (actMode === "existing" && !!actId) ||
        (actMode === "new" && actNew.trim().length >= 2);

      if (hasAct) {
        payload.activity =
          actMode === "existing"
            ? { type: "existing", id: actId }
            : { type: "new", name: actNew.trim() };
      }

      const res = await submitVote(payload);

      // res peut contenir des infos "déjà voté"
      if (res?.warnings?.length) {
        setMessage({ type: "warn", text: res.warnings.join(" ") });
      } else {
        setMessage({ type: "ok", text: "Vote enregistré ✅" });
      }
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erreur lors du vote." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={{ marginTop: 0 }}>Voter 🎁</h1>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
          Appareil: {deviceId.slice(0, 8)}…
        </div>

        {!options ? (
          <div>Chargement…</div>
        ) : (
          <>
            <Block title="Destination">
              <Toggle mode={destMode} setMode={setDestMode} />
              {destMode === "existing" ? (
                <select
                  style={styles.select}
                  value={destId}
                  onChange={(e) => setDestId(e.target.value)}
                >
                  {options.destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  style={styles.input}
                  placeholder="Ex: Brésil"
                  value={destNew}
                  onChange={(e) => setDestNew(e.target.value)}
                />
              )}
            </Block>

            <Block title="Activité">
              <Toggle mode={actMode} setMode={setActMode} />
              {actMode === "existing" ? (
                <select
                  style={styles.select}
                  value={actId}
                  onChange={(e) => setActId(e.target.value)}
                >
                  {options.activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  style={styles.input}
                  placeholder="Ex: Pêche"
                  value={actNew}
                  onChange={(e) => setActNew(e.target.value)}
                />
              )}
            </Block>

            <button
              style={{
                ...styles.button,
                opacity: loading || !canSubmit ? 0.6 : 1,
                cursor: loading || !canSubmit ? "not-allowed" : "pointer",
              }}
              onClick={onSubmit}
              disabled={loading || !canSubmit}
            >
              {loading ? "Envoi…" : "Valider"}
            </button>

            {message && (
              <div style={{ ...styles.msg, ...msgStyle(message.type) }}>
                {message.text}
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Mode 2 : tu peux voter destination, activité, ou les deux.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 18, margin: "10px 0" }}>{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ mode, setMode }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setMode("existing")}
        style={{ ...styles.smallBtn, opacity: mode === "existing" ? 1 : 0.5 }}
      >
        Choisir
      </button>
      <button
        type="button"
        onClick={() => setMode("new")}
        style={{ ...styles.smallBtn, opacity: mode === "new" ? 1 : 0.5 }}
      >
        Proposer
      </button>
    </div>
  );
}

function msgStyle(type) {
  if (type === "ok") return { background: "#e8ffe8", border: "1px solid #b6f2b6" };
  if (type === "warn") return { background: "#fff8e6", border: "1px solid #ffe0a3" };
  return { background: "#ffecec", border: "1px solid #ffb3b3" };
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 16,
    background: "#fafafa",
  },
  card: {
    width: "min(520px, 100%)",
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
  },
  select: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 16,
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 16,
  },
  button: {
    marginTop: 16,
    width: "100%",
    padding: 14,
    borderRadius: 10,
    border: "none",
    background: "#111",
    color: "white",
    fontSize: 16,
    fontWeight: 700,
  },
  smallBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
  },
  msg: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    fontSize: 14,
  },
};
