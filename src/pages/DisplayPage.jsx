import React, { useEffect, useMemo, useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { getResults } from "../lib/api.js";
import { fetchDestinationImage } from "../lib/image.js";

export default function DisplayPage() {
    // Progress bar state for slider
    const [sliderProgress, setSliderProgress] = useState(1); // 1 = full, 0 = empty
    const [sliderTimeLeft, setSliderTimeLeft] = useState(10);
    const progressIntervalRef = useRef();
  const [data, setData] = useState(null);
  const [sliderIndex, setSliderIndex] = useState(0);
  // images: { [destinationName]: { url, alt, photographer, source } }
  const [images, setImages] = useState({});
  const sliderIntervalRef = useRef();
  const prevTopDestNamesRef = useRef([]);

  const voteUrl = `${window.location.origin}${import.meta.env.BASE_URL}#/vote`;

  // Fetch results every 10s
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await getResults();
        if (alive) setData(r);
      } catch (e) {}
    };
    tick();
    const id = setInterval(tick, 600000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Slider: change every 10s, independent of backend polling
  const topDestRows = data?.destination?.rows?.slice(0, 5) || [];
  useEffect(() => {
    if (!topDestRows.length) return;
    if (sliderIntervalRef.current) clearInterval(sliderIntervalRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    setSliderProgress(1);
    setSliderTimeLeft(10);

    // Progress bar and timer update every 100ms
    progressIntervalRef.current = setInterval(() => {
      setSliderProgress((prev) => Math.max(0, prev - 0.01));
      setSliderTimeLeft((prev) => Math.max(0, +(prev - 0.1).toFixed(1)));
    }, 100);

    // Slider change every 10s
    sliderIntervalRef.current = setInterval(() => {
      setSliderIndex((i) => {
        const max = topDestRows.length;
        return (i + 1) % max;
      });
      setSliderProgress(1);
      setSliderTimeLeft(10);
    }, 10000);

    return () => {
      clearInterval(sliderIntervalRef.current);
      clearInterval(progressIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topDestRows.length]);

  // Only reset sliderIndex if the topDestRows shrinks below the current index
  useEffect(() => {
    if (sliderIndex >= topDestRows.length) {
      setSliderIndex(0);
    }
    // If the top destinations list changes order, do not reset the index
    // If the list shrinks, reset if out of bounds
    // If the list grows, keep the current index
    // If the list is empty, reset to 0
  }, [topDestRows.length]);

  // Get current destination for slider
  const currentDest = topDestRows.length > 0 ? topDestRows[sliderIndex % topDestRows.length] : null;

  // Fetch image for the current destination at switch time if not cached
  useEffect(() => {
    if (!currentDest || images[currentDest.name]) return;
    let cancelled = false;
    async function fetchImage() {
      const imgObj = await fetchDestinationImage(currentDest.name);
      if (!cancelled) {
        setImages((prev) => ({ ...prev, [currentDest.name]: imgObj }));
      }
    }
    fetchImage();
    return () => { cancelled = true; };
  }, [currentDest, images]);

  // (Removed: no longer force slider to change on backend update)

    return (
      <div className="display-fullscreen" style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        background: '#fff',
        color: '#222',
        overflow: 'hidden',
      }}>
        {/* Slider (50% width) on top */}
        <div style={{ width: '100%', padding: '32px 0 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 340 }}>
          <h1 style={{ margin: 0, fontSize: 36, letterSpacing: 1 }}>Où va aller Garry ? 🎁</h1>
          <div style={{ width: '50vw', minWidth: 320, minHeight: 320, marginTop: 24, maxWidth: 700, padding: 0, marginLeft: 'auto', marginRight: 'auto' }}>
            {currentDest ? (
              <div style={{
                border: '1px solid #eee',
                borderRadius: 20,
                boxShadow: '0 6px 32px rgba(0,0,0,0.08)',
                overflow: 'hidden',
                background: '#fafafa',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minHeight: 320,
                position: 'relative',
                width: '100%',
                maxWidth: '100vw',
              }}>
                <div style={{ width: '100%', height: 220, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {/* Photo credit overlay, bottom left, above image */}
                  {images[currentDest.name]?.photographer && (
                    <div style={{
                      position: 'absolute',
                      left: 2,
                      bottom: 2,
                      zIndex: 2,
                      color: '#fff',
                      background: 'rgba(0,0,0,0.32)',
                      padding: '2px 8px 2px 2px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 400,
                      textShadow: '0 1px 4px rgba(0,0,0,0.7)',
                      maxWidth: '80%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      Crédit : {images[currentDest.name].photographer} / Unsplash
                    </div>
                  )}
                  {images[currentDest.name]?.url ? (
                    <img src={images[currentDest.name].url} alt={images[currentDest.name].alt || currentDest.name} style={{ width: '100%', height: 220, objectFit: 'cover', maxWidth: '100vw' }} />
                  ) : (
                    <span>Chargement de l'image…</span>
                  )}
                  {/* Overlay progress bar at bottom */}
                  <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 5, background: 'rgba(0,0,0,0.18)', borderRadius: 0, overflow: 'hidden' }}>
                    <div style={{ width: `${sliderProgress * 100}%`, height: '100%', background: 'rgba(0,0,0,0.55)', transition: 'width 0.1s linear' }} />
                  </div>
                </div>
                <div style={{ padding: 18, width: '100%', textAlign: 'center' }}>
                  <h2 style={{ margin: '0 0 10px 0', fontSize: 30 }}>
                    {sliderIndex === 0 ? '🥇' : sliderIndex === 1 ? '🥈' : sliderIndex === 2 ? '🥉' : ''} #{sliderIndex + 1} {currentDest.name}
                  </h2>
                  {/* ...existing code... */}
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#333' }}>{currentDest.percent}%</div>
                  <div style={{ fontSize: 16, color: '#888' }}>{currentDest.count} votes</div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#888', padding: 24 }}>Aucune destination à afficher.</div>
            )}
          </div>
        </div>
        {/* Leaderboards row */}
        <div style={{ display: 'flex', flex: 1, width: '100%', minHeight: 0 }}>
          {/* Left: Destinations */}
          <div style={{ flex: 1, padding: '32px 24px 24px 40px', overflowY: 'auto', minWidth: 0 }}>
            <Section title="Destinations" block={data?.destination} />
          </div>
          {/* Right: Activities */}
          <div style={{ flex: 1, padding: '32px 40px 24px 24px', overflowY: 'auto', minWidth: 0, borderLeft: '1px solid #eee' }}>
            <Section title="Activités" block={data?.activity} />
          </div>
        </div>
        {/* Bottom: QR code and title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%', padding: '0 40px 18px 40px', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ background: '#fafafa', borderRadius: 12, border: '1px solid #eee', padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <a href={voteUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block' }}>
                <QRCodeCanvas value={voteUrl} size={140} style={{ cursor: 'pointer' }} />
              </a>
            </div>
            {/* <div style={{ fontSize: 20, opacity: 0.8, marginLeft: 18, wordBreak: 'break-all', maxWidth: 260 }}>{voteUrl}</div> */}
            <div style={{ fontWeight: 600, fontSize: 24, color: '#222', textAlign: 'left', marginLeft: 32 }}>
              Vote maintenant et influence le choix
              <div style={{ fontSize: 14, color: '#666', marginTop: 6, fontWeight: 400 }}>
                Clique ou scanne le code QR
              </div>
            </div>
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
