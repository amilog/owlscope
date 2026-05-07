import { useEffect, useState } from 'react';
import { Download, Apple, Cpu, Monitor } from 'lucide-react';

type Platform = 'mac-arm' | 'mac-intel' | 'windows' | 'linux' | 'linux-deb' | 'unknown';

const RELEASES_API = 'https://api.github.com/repos/YOUR_USERNAME/owlscope/releases/latest';

const LABEL: Record<Platform, string> = {
  'mac-arm': 'macOS (Apple Silicon)',
  'mac-intel': 'macOS (Intel)',
  windows: 'Windows',
  linux: 'Linux (AppImage)',
  'linux-deb': 'Linux (.deb)',
  unknown: 'Choose your platform',
};

export default function PlatformDetect() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [version, setVersion] = useState<string>('latest');
  const [downloads, setDownloads] = useState<Partial<Record<Platform, string>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void detectPlatform();
    void fetchReleases();
  }, []);

  async function detectPlatform() {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent;
    if (/Mac/.test(ua)) {
      const dataApi = (navigator as unknown as { userAgentData?: { getHighEntropyValues: (keys: string[]) => Promise<{ architecture?: string }> } }).userAgentData;
      if (dataApi) {
        try {
          const data = await dataApi.getHighEntropyValues(['architecture']);
          setPlatform(data.architecture === 'arm' ? 'mac-arm' : 'mac-intel');
          return;
        } catch {
          /* fall through to webgl heuristic */
        }
      }
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
        const renderer = debugInfo ? gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
        setPlatform(typeof renderer === 'string' && renderer.includes('Apple') ? 'mac-arm' : 'mac-intel');
      } catch {
        setPlatform('mac-intel');
      }
    } else if (/Win/.test(ua)) setPlatform('windows');
    else if (/Linux/.test(ua)) setPlatform('linux');
  }

  async function fetchReleases() {
    try {
      const res = await fetch(RELEASES_API);
      if (!res.ok) throw new Error('release fetch failed');
      const data: { tag_name?: string; assets?: { name: string; browser_download_url: string }[] } = await res.json();
      if (data.tag_name) setVersion(data.tag_name);
      const links: Partial<Record<Platform, string>> = {};
      data.assets?.forEach((asset) => {
        const n = asset.name.toLowerCase();
        if (n.includes('arm64.dmg')) links['mac-arm'] = asset.browser_download_url;
        else if (n.endsWith('.dmg')) links['mac-intel'] = asset.browser_download_url;
        else if (n.endsWith('.exe')) links.windows = asset.browser_download_url;
        else if (n.endsWith('.appimage')) links.linux = asset.browser_download_url;
        else if (n.endsWith('.deb')) links['linux-deb'] = asset.browser_download_url;
      });
      setDownloads(links);
    } catch {
      /* network or rate-limit; hard-coded fallbacks would go here later */
    } finally {
      setLoading(false);
    }
  }

  const primary = platform !== 'unknown' ? downloads[platform] : undefined;
  const platformIcon = platform.startsWith('mac') ? Apple : platform === 'windows' ? Monitor : Cpu;
  const PIcon = platformIcon;

  return (
    <div className="owl-pd">
      {primary ? (
        <a href={primary} className="owl-pd__primary" download>
          <PIcon size={28} />
          <div>
            <div className="title">Download for {LABEL[platform]}</div>
            <div className="version">v{version.replace(/^v/, '')} · macOS, Windows &amp; Linux supported</div>
          </div>
          <Download size={20} className="grow" />
        </a>
      ) : (
        <div className="owl-pd__primary owl-pd__primary--placeholder">
          {loading ? 'Detecting your system…' : 'Pick a platform below'}
        </div>
      )}

      <div className="owl-pd__others">
        <h3>All downloads</h3>
        <div className="grid">
          {(['mac-arm', 'mac-intel', 'windows', 'linux', 'linux-deb'] as Platform[]).map((p) => {
            const url = downloads[p];
            return (
              <a
                key={p}
                href={url ?? '#'}
                className={`item ${url ? '' : 'disabled'} ${p === platform ? 'current' : ''}`}
                {...(url ? { download: true } : { 'aria-disabled': true })}
              >
                <span className="label">{LABEL[p]}</span>
                <span className="status">
                  {url ? 'Download' : 'Unavailable'}
                </span>
              </a>
            );
          })}
        </div>
      </div>

      <style>{`
        .owl-pd { margin: 32px 0; }
        .owl-pd__primary {
          display: flex;
          align-items: center;
          gap: 16px;
          background: linear-gradient(135deg, var(--sl-color-accent) 0%, #7c3aed 100%);
          color: #fff;
          padding: 22px 24px;
          border-radius: 14px;
          text-decoration: none;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 0 30px 80px -30px rgba(167, 139, 250, 0.5);
        }
        .owl-pd__primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 35px 90px -30px rgba(167, 139, 250, 0.7);
        }
        .owl-pd__primary .title { font-size: 18px; font-weight: 600; }
        .owl-pd__primary .version { font-size: 13px; opacity: 0.85; margin-top: 2px; }
        .owl-pd__primary .grow { margin-left: auto; }
        .owl-pd__primary--placeholder {
          background: var(--sl-color-gray-6);
          color: var(--sl-color-gray-2);
          justify-content: center;
        }

        .owl-pd__others { margin-top: 32px; }
        .owl-pd__others h3 {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--sl-color-gray-2);
          margin: 0 0 12px;
        }
        .owl-pd__others .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 8px;
        }
        .owl-pd__others .item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--sl-color-gray-6);
          border: 1px solid var(--sl-color-gray-5);
          border-radius: 8px;
          color: var(--sl-color-white);
          font-size: 14px;
          text-decoration: none;
          transition: all 0.15s;
        }
        .owl-pd__others .item:hover:not(.disabled) {
          border-color: var(--sl-color-accent);
          color: var(--sl-color-accent);
        }
        .owl-pd__others .item.disabled {
          opacity: 0.5;
          pointer-events: none;
        }
        .owl-pd__others .item.current { border-color: var(--sl-color-accent); }
        .owl-pd__others .item .status { font-size: 12px; color: var(--sl-color-gray-2); }
      `}</style>
    </div>
  );
}
