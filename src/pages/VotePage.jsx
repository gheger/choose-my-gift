import React, { useEffect, useMemo, useState } from "react";

// Add viewport meta for mobile if not already in index.html
if (typeof document !== 'undefined' && !document.querySelector('meta[name="viewport"]')) {
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
  document.head.appendChild(meta);
}
import { getOptions, submitVote } from "../lib/api.js";
import { getOrCreateDeviceId } from "../lib/device.js";

export default function VotePage() {
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(false);

  // destination
  const [destMode, setDestMode] = useState("existing"); // existing | new | null
  const [destId, setDestId] = useState("");
  const [destNew, setDestNew] = useState("");

  // activity
  const [actMode, setActMode] = useState("existing"); // existing | new | null
  const [actId, setActId] = useState("");
  const [actNew, setActNew] = useState("");

    const [voterName, setVoterName] = useState("");
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

    // At least one of destination or activity must be entered
    return hasDest || hasAct;
  }, [destMode, destId, destNew, actMode, actId, actNew]);

  async function onSubmit() {
    setMessage(null);
    if (!canSubmit) {
      setMessage({ type: "error", text: "Veuillez entrer au moins une destination ou une activité." });
      return;
    }
    setLoading(true);
    try {
      const payload = { deviceId };
      if (voterName.trim().length > 0) {
        payload.voterName = voterName.trim();
      }

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
        // Si au moins un warning contient "déjà voté pour cet appareil", n'afficher le message personnalisé qu'une seule fois
        const hasAlreadyVoted = res.warnings.some(w => w.includes("déjà voté pour cet appareil"));
        let customWarning = res.warnings.filter(w => !w.includes("déjà voté pour cet appareil")).join(" ");
        if (hasAlreadyVoted) {
          customWarning = (customWarning ? "Tu ne peux voter qu'une fois toutes les 12 heures " : "") + "Tu ne peux voter qu'une fois toutes les 12 heures";
          customWarning = "Tu ne peux voter qu'une fois toutes les 12 heures" + (customWarning.trim() ? (" " + customWarning.trim()) : "");
          customWarning = "Tu ne peux voter qu'une fois toutes les 12 heures";
        }
        setMessage({ type: "warn", text: customWarning.trim() });
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
    <div style={{...styles.page, width: '100vw', minWidth: 0, boxSizing: 'border-box', padding: 0}}>
      <div style={{...styles.card, width: '100%', minWidth: 0, maxWidth: '100vw', margin: '0 auto', boxSizing: 'border-box'}} className="vote-card">
        <h1 style={{ marginTop: 0 }}>Ton vote 🎁</h1>
        <div style={{ marginBottom: 16 }}>
          <input
            style={{ ...styles.input, maxWidth: 320, margin: "0 auto", display: "block" }}
            type="text"
            placeholder="Votre prénom (optionnel)"
            value={voterName}
            onChange={e => setVoterName(e.target.value)}
            aria-label="Votre prénom"
            autoComplete="off"
          />
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
                  aria-label="Choisir une destination"
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
                  aria-label="Proposer une destination"
                  autoComplete="off"
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
                  aria-label="Choisir une activité"
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
                  aria-label="Proposer une activité"
                  autoComplete="off"
                />
              )}
            </Block>

            <button
              style={{
                ...styles.button,
                opacity: loading || !canSubmit ? 0.6 : 1,
                cursor: loading || !canSubmit ? "not-allowed" : "pointer",
                touchAction: "manipulation",
                minHeight: 48,
                fontSize: 18,
              }}
              onClick={onSubmit}
              disabled={loading || !canSubmit}
              aria-label="Valider le vote"
            >
              {loading ? "Envoi…" : "Valider"}
            </button>



            {message && (
              <div style={{ ...styles.msg, ...msgStyle(message.type) }}>
                {message.text}
                {message.type === "ok" && (
                  <div style={{ marginTop: 10 }}>
                    <a href="/choose-my-gift/#/display" style={{ color: '#222', textDecoration: 'underline', fontWeight: 500 }}>
                      Voir les résultats
                    </a>
                  </div>
                )}
              </div>
            )}


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
  // Allow unselecting by clicking again
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setMode(mode === "existing" ? null : "existing")}
        style={{ ...styles.smallBtn, opacity: mode === "existing" ? 1 : 0.5 }}
        aria-pressed={mode === "existing"}
      >
        Choisir
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === "new" ? null : "new")}
        style={{ ...styles.smallBtn, opacity: mode === "new" ? 1 : 0.5 }}
        aria-pressed={mode === "new"}
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
    display: "block",
    padding: 8,
    background: "#fff",
    color: "#222",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 6px 24px rgba(0,0,0,0.10)",
    margin: "0 8px",
    color: "#222",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: 14,
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 18,
    background: "#f9f9f9",
    color: "#222",
    minHeight: 44,
    boxSizing: "border-box",
  },
  input: {
    width: "100%",
    padding: 14,
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 18,
    background: "#f9f9f9",
    color: "#222",
    minHeight: 44,
    boxSizing: "border-box",
  },
  button: {
    marginTop: 16,
    width: "100%",
    padding: 16,
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(90deg,#111 60%,#444 100%)",
    color: "white",
    fontSize: 18,
    fontWeight: 700,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    transition: "background 0.2s",
    minHeight: 48,
    touchAction: "manipulation",
  },
  smallBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#f9f9f9",
    color: "#222",
    fontWeight: 500,
    fontSize: 16,
    transition: "background 0.2s",
    minHeight: 44,
    boxSizing: "border-box",
  },
  msg: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    color: "#222",
    fontWeight: 500,
    boxSizing: "border-box",
  },
};
