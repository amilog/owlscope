import { useEffect, useState } from 'react';

interface Shot {
  src: string;
  label: string;
  description: string;
}

const SHOTS: Shot[] = [
  {
    src: '/screenshots/logs-panel.svg',
    label: 'Logs',
    description: 'Every console.log, print, warn, error in real-time — with full stack traces and source maps.',
  },
  {
    src: '/screenshots/network-panel.svg',
    label: 'Network',
    description: 'Inspect every HTTP call: headers, payloads, timing, response bodies. cURL replay built in.',
  },
  {
    src: '/screenshots/state-panel.svg',
    label: 'State',
    description: 'Track Redux, Riverpod, Bloc state changes. Diff old vs new. Time-travel through history.',
  },
  {
    src: '/screenshots/errors-panel.svg',
    label: 'Errors',
    description: 'Crashes and uncaught exceptions surface immediately with the originating stack frame.',
  },
];

export default function ScreenshotShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % SHOTS.length), 4500);
    return () => clearInterval(t);
  }, [paused]);

  const shot = SHOTS[active];

  return (
    <div
      className="owl-showcase"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="owl-showcase__tabs">
        {SHOTS.map((s, i) => (
          <button
            key={s.label}
            className={`tab ${active === i ? 'active' : ''}`}
            onClick={() => setActive(i)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="owl-showcase__frame">
        <img src={shot.src} alt={`${shot.label} panel`} loading="lazy" />
      </div>
      <p className="owl-showcase__caption">{shot.description}</p>
      <style>{`
        .owl-showcase {
          margin: 32px auto;
          max-width: 960px;
        }
        .owl-showcase__tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--sl-color-gray-6);
          border: 1px solid var(--sl-color-gray-5);
          border-radius: 10px;
          width: fit-content;
          margin: 0 auto 16px;
        }
        .owl-showcase__tabs .tab {
          background: transparent;
          color: var(--sl-color-gray-2);
          border: none;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .owl-showcase__tabs .tab:hover { color: var(--sl-color-white); }
        .owl-showcase__tabs .tab.active {
          background: var(--sl-color-accent);
          color: var(--sl-color-bg);
        }
        .owl-showcase__frame {
          background: var(--sl-color-gray-6);
          border: 1px solid var(--sl-color-gray-5);
          border-radius: 12px;
          overflow: hidden;
          aspect-ratio: 16 / 10;
          position: relative;
        }
        .owl-showcase__frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          animation: owl-fade-in 0.5s ease;
        }
        .owl-showcase__caption {
          text-align: center;
          color: var(--sl-color-gray-2);
          font-size: 14px;
          margin-top: 16px;
          line-height: 1.6;
        }
        @keyframes owl-fade-in {
          from { opacity: 0; transform: scale(0.99); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
