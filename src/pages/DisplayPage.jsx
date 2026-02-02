import React, { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { getResults } from "../lib/api.js";

export default function DisplayPage() {
  const [data, setData] = useState(null);

  const voteUrl = useMemo(() => {
    // BASE_URL inclut "/choose-my-gift/"
    return `${window.location.origin}${import.meta.env.BASE_URL}vote`;
  }, []);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const r = await getResults();
        if (alive) setData(r);
      } catch (e) {
        // ignore
      }
    };

    tick();
    const id = setInterval(tick, 2000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", padding: 24, gap: 24 }}>
      <div style={{ flex: 1, overflow: "auto" }}>
        <h1 style={{ marginTop: 0 }}>Vote Live 🎁</h1>

        <Section title="Destinations" block={data?.destination} />
        <Section title="Activités" block={data?.activity} />
      </div>

      <div
        style={{
          width: 340,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          borderLeft: "1px solid #eee",
          paddingLeft: 24,
        }}
      >
        <h2 style={{ margin: 0 }}>Scanner pour voter</h2>
        <QRCodeCanvas value={voteUrl} size={260} />
        <div style={{ fontSize: 12, opacity: 0.8, textAlign: "center" }}>
          {voteUrl}
        </div>
      </div>
    </div>
  );
}

function Section({ title, block }) {
  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ marginBottom: 12 }}>{title}</h2>

      {!block ? (
        <div>Chargement…</div>
      ) : block.total === 0 ? (
        <div style={{ opacity: 0.7 }}>Aucun vote pour l’instant.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {block.rows.map((r) => (
            <div key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{r.name}</strong>
                <span>
                  {r.percent}% ({r.count})
                </span>
              </div>
              <div style={{ height: 12, background: "#eee", borderRadius: 6 }}>
                <div
                  style={{
                    height: 12,
                    width: `${r.percent}%`,
                    background: "#111",
                    borderRadius: 6,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
