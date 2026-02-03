import React, { useEffect, useMemo, useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { getResults } from "../lib/api.js";
import { fetchDestinationImage } from "../lib/image.js";

export default function DisplayPage() {
  const [data, setData] = useState(null);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [images, setImages] = useState({});
  const intervalRef = useRef();

  const voteUrl = `${window.location.origin}${import.meta.env.BASE_URL}#/vote`;

  // Fetch results every 2s
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await getResults();
        if (alive) setData(r);
      } catch (e) {}
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Slider: change every 10s, always show a different image
  useEffect(() => {
    if (!data?.destination?.rows?.length) return;
    intervalRef.current && clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSliderIndex((i) => {
        const max = Math.min(5, data.destination.rows.length);
        // Always go to the next, never repeat
        return (i + 1) % max;
      });
    }, 10000);
    return () => clearInterval(intervalRef.current);
  }, [data]);

  // Fetch images for top 5 destinations, cache, and limit API calls
  useEffect(() => {
    let cancelled = false;
    async function fetchImages() {
      if (!data?.destination?.rows) return;
      const top5 = data.destination.rows.slice(0, 5);
      // Only fetch images for destinations not already cached
      const toFetch = top5.filter((dest) => !images[dest.name]);
      // Limit to 2 API calls per refresh to avoid hitting rate limits
      const fetchBatch = toFetch.slice(0, 2);
      if (fetchBatch.length === 0) return;
      const newImages = {};
      for (const dest of fetchBatch) {
        newImages[dest.name] = await fetchDestinationImage(dest.name);
        if (cancelled) return;
      }
      if (Object.keys(newImages).length > 0) {
        setImages((prev) => ({ ...prev, ...newImages }));
      }
    }
    fetchImages();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [data, images]);

  // Get current destination for slider
  const topDestRows = data?.destination?.rows?.slice(0, 5) || [];
  // Always show a different image: if only one, show it; if more, cycle through all
  const currentDest = topDestRows.length > 0 ? topDestRows[sliderIndex % topDestRows.length] : null;

  // Force slider to change if the same destination stays selected after data update
  useEffect(() => {
    if (!topDestRows.length) return;
    // If the current destination is the same as before and there is more than one destination, force change
    if (topDestRows.length > 1 && topDestRows[sliderIndex]?.name === currentDest?.name) {
      setSliderIndex((i) => (i + 1) % topDestRows.length);
    }
    // If the index is out of bounds (e.g., top 5 shrank), reset to 0
    if (sliderIndex >= topDestRows.length) {
      setSliderIndex(0);
    }
    // eslint-disable-next-line
  }, [data]);

  return (
    <div className="display-fullscreen" style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gridTemplateRows: '1fr 120px',
      gridTemplateAreas: `
        'slider destinations activities'
        'qr destinations activities'
      `,
      height: '100vh',
      width: '100vw',
      background: '#fff',
      color: '#222',
      overflow: 'hidden',
      gap: 0
    }}>
      {/* Top left: Slider */}
      <div style={{ gridArea: 'slider', padding: '32px 24px 8px 40px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 32, letterSpacing: 1 }}>Où va aller Garry ? 🎁</h1>
        <div style={{ width: '100%', maxWidth: 380, minHeight: 220, marginTop: 16 }}>
          {currentDest ? (
            <div style={{
              border: '1px solid #eee',
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minHeight: 220,
              position: 'relative',
            }}>
              <div style={{ width: '100%', height: 140, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {images[currentDest.name] ? (
                  <img src={images[currentDest.name]} alt={currentDest.name} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                ) : (
                  <span>Chargement de l'image…</span>
                )}
              </div>
              <div style={{ padding: 12, width: '100%', textAlign: 'center' }}>
                <h2 style={{ margin: '0 0 6px 0', fontSize: 22 }}>
                  #{sliderIndex + 1} {currentDest.name}
                </h2>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>{currentDest.percent}%</div>
                <div style={{ fontSize: 13, color: '#888' }}>{currentDest.count} votes</div>
              </div>
              <div style={{ position: 'absolute', top: 6, right: 12, fontSize: 14, color: '#888' }}>
                {sliderIndex + 1} / {topDestRows.length}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#888', padding: 16 }}>Aucune destination à afficher.</div>
          )}
        </div>
      </div>
      {/* Bottom left: QR code */}
      <div style={{ gridArea: 'qr', padding: '0 24px 24px 40px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
        <div style={{ background: '#fafafa', borderRadius: 12, border: '1px solid #eee', padding: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <QRCodeCanvas value={voteUrl} size={80} />
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, wordBreak: 'break-all', maxWidth: 120 }}>{voteUrl}</div>
      </div>
      {/* Middle: Destinations */}
      <div style={{ gridArea: 'destinations', padding: '32px 32px 24px 32px', overflowY: 'auto', minWidth: 0 }}>
        <Section title="Destinations" block={data?.destination} />
      </div>
      {/* Right: Activities */}
      <div style={{ gridArea: 'activities', padding: '32px 40px 24px 32px', overflowY: 'auto', minWidth: 0, borderLeft: '1px solid #eee' }}>
        <Section title="Activités" block={data?.activity} />
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
          {block.rows.map((r, idx) => {
            let barColor = '#e74c3c'; // default: red
            if (idx === 0) barColor = '#27ae60'; // green
            else if (idx === 1) barColor = '#f39c12'; // orange
            else if (idx === 2) barColor = '#f7e017'; // yellow
            return (
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
                      background: barColor,
                      borderRadius: 6,
                      transition: 'width 0.5s',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
