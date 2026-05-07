import { useEffect, useState } from 'react';

interface Line {
  prompt: string;
  text: string;
  delay: number;
  color?: 'success' | 'muted';
}

const LINES: Line[] = [
  { prompt: '$', text: 'npm install -D owlscope', delay: 35 },
  { prompt: '+', text: 'owlscope@0.1.0 added 1 package', delay: 25, color: 'success' },
  { prompt: '$', text: "echo \"import 'owlscope/auto'\" >> src/main.tsx", delay: 35 },
  { prompt: '$', text: 'npm run dev', delay: 35 },
  { prompt: '✓', text: 'Connected to OwlScope', delay: 25, color: 'success' },
  { prompt: '✓', text: 'Streaming events to localhost:9090', delay: 25, color: 'success' },
];

export default function TerminalDemo() {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    if (lineIdx >= LINES.length) {
      const restart = setTimeout(() => {
        setLineIdx(0);
        setCharIdx(0);
      }, 5000);
      return () => clearTimeout(restart);
    }
    const line = LINES[lineIdx];
    if (charIdx < line.text.length) {
      const t = setTimeout(() => setCharIdx((c) => c + 1), line.delay);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLineIdx((i) => i + 1);
      setCharIdx(0);
    }, 350);
    return () => clearTimeout(t);
  }, [lineIdx, charIdx]);

  const visible = LINES.slice(0, Math.min(lineIdx + 1, LINES.length));

  return (
    <div className="owl-terminal">
      <div className="owl-terminal__chrome">
        <span className="dot red" />
        <span className="dot yellow" />
        <span className="dot green" />
        <span className="title">~/my-app — owlscope</span>
      </div>
      <div className="owl-terminal__body">
        {visible.map((line, i) => {
          const isCurrent = i === lineIdx && lineIdx < LINES.length;
          const text = isCurrent ? line.text.slice(0, charIdx) : line.text;
          return (
            <div key={i} className={`row ${line.color ?? ''}`}>
              <span className="prompt">{line.prompt}</span>
              <span className="text">{text}</span>
              {isCurrent && <span className="cursor">▮</span>}
            </div>
          );
        })}
      </div>
      <style>{`
        .owl-terminal {
          background: #0d0d0d;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          overflow: hidden;
          font-family: var(--sl-font-mono);
          font-size: 13px;
          line-height: 1.7;
          max-width: 720px;
          margin: 32px auto 0;
          box-shadow: 0 30px 80px -30px rgba(167, 139, 250, 0.25);
        }
        .owl-terminal__chrome {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #131313;
          border-bottom: 1px solid #1f1f1f;
        }
        .owl-terminal__chrome .dot {
          width: 11px;
          height: 11px;
          border-radius: 50%;
        }
        .owl-terminal__chrome .red { background: #ff5f56; }
        .owl-terminal__chrome .yellow { background: #ffbd2e; }
        .owl-terminal__chrome .green { background: #27c93f; }
        .owl-terminal__chrome .title {
          margin-left: 12px;
          color: #888;
          font-size: 12px;
        }
        .owl-terminal__body {
          padding: 18px 20px 22px;
          color: #e5e5e5;
          min-height: 220px;
        }
        .owl-terminal__body .row {
          display: flex;
          gap: 8px;
          align-items: baseline;
        }
        .owl-terminal__body .prompt {
          color: #888;
          flex-shrink: 0;
        }
        .owl-terminal__body .row.success .prompt { color: #4ade80; }
        .owl-terminal__body .row.success .text { color: #4ade80; }
        .owl-terminal__body .text { white-space: pre-wrap; word-break: break-word; }
        .cursor {
          display: inline-block;
          margin-left: 2px;
          color: #a78bfa;
          animation: owl-blink 1s step-end infinite;
        }
        @keyframes owl-blink {
          0%, 60% { opacity: 1; }
          60.01%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
