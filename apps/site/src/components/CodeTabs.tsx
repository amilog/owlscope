import { useState } from 'react';

interface Tab {
  label: string;
  filename: string;
  language: string;
  code: string;
}

const TABS: Tab[] = [
  {
    label: 'React',
    filename: 'main.tsx',
    language: 'tsx',
    code: `import 'owlscope/auto';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);`,
  },
  {
    label: 'React Native',
    filename: 'index.js',
    language: 'js',
    code: `import 'owlscope/auto';
import { AppRegistry } from 'react-native';
import App from './App';

AppRegistry.registerComponent('main', () => App);`,
  },
  {
    label: 'Flutter',
    filename: 'main.dart',
    language: 'dart',
    code: `import 'package:owlscope/auto.dart';
import 'package:flutter/material.dart';

void main() {
  owlscopeAuto(() => runApp(const MyApp()));
}`,
  },
  {
    label: 'Node.js',
    filename: 'server.ts',
    language: 'ts',
    code: `import 'owlscope/auto';
import express from 'express';

const app = express();
app.listen(3000);`,
  },
];

export default function CodeTabs() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <div className="owl-codetabs">
      <div className="owl-codetabs__head">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            className={`tab ${i === active ? 'active' : ''}`}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="owl-codetabs__file">{tab.filename}</div>
      <pre className="owl-codetabs__code">
        <code>{tab.code}</code>
      </pre>
      <style>{`
        .owl-codetabs {
          background: var(--sl-color-gray-6);
          border: 1px solid var(--sl-color-gray-5);
          border-radius: 12px;
          overflow: hidden;
          max-width: 720px;
          margin: 32px auto;
          font-family: var(--sl-font-mono);
        }
        .owl-codetabs__head {
          display: flex;
          gap: 4px;
          padding: 8px 8px 0;
          border-bottom: 1px solid var(--sl-color-gray-5);
          overflow-x: auto;
        }
        .owl-codetabs__head .tab {
          background: transparent;
          color: var(--sl-color-gray-2);
          border: none;
          padding: 8px 14px;
          border-radius: 6px 6px 0 0;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: var(--sl-font);
          white-space: nowrap;
        }
        .owl-codetabs__head .tab:hover { color: var(--sl-color-white); }
        .owl-codetabs__head .tab.active {
          background: var(--sl-color-bg);
          color: var(--sl-color-accent);
          border-bottom: 2px solid var(--sl-color-accent);
        }
        .owl-codetabs__file {
          padding: 6px 16px;
          color: var(--sl-color-gray-2);
          font-size: 12px;
          background: var(--sl-color-bg);
          border-bottom: 1px solid var(--sl-color-gray-5);
        }
        .owl-codetabs__code {
          margin: 0;
          padding: 18px 20px;
          background: var(--sl-color-bg);
          font-size: 13px;
          line-height: 1.7;
          color: var(--sl-color-white);
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
}
