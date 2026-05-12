import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Locate `adb` without requiring the user to add it to PATH — picks the
 *  same well-known SDK locations RN CLI and Flutter use. Returns `null`
 *  if no adb is reachable; the watcher then quietly no-ops (iOS-only and
 *  web developers shouldn't see noise). */
function findAdb(): string | null {
  try {
    const onPath = execFileSync('which', ['adb'], { encoding: 'utf8' }).trim();
    if (onPath && existsSync(onPath)) return onPath;
  } catch {
    /* fallthrough */
  }
  const home = homedir();
  const candidates = [
    process.env['ANDROID_HOME'] && join(process.env['ANDROID_HOME'], 'platform-tools', 'adb'),
    process.env['ANDROID_SDK_ROOT'] &&
      join(process.env['ANDROID_SDK_ROOT'], 'platform-tools', 'adb'),
    join(home, 'Library/Android/sdk/platform-tools/adb'),
    join(home, 'Android/Sdk/platform-tools/adb'),
  ].filter((p): p is string => !!p);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function listDevices(adb: string): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(adb, ['devices'], { timeout: 3000 }, (err, stdout) => {
      if (err) return resolve([]);
      const ids: string[] = [];
      for (const raw of stdout.split('\n').slice(1)) {
        const line = raw.trim();
        if (!line) continue;
        const [id, status] = line.split(/\s+/);
        if (status === 'device' && id) ids.push(id);
      }
      resolve(ids);
    });
  });
}

function applyReverse(adb: string, deviceId: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      adb,
      ['-s', deviceId, 'reverse', `tcp:${port}`, `tcp:${port}`],
      { timeout: 3000 },
      (err) => resolve(!err),
    );
  });
}

export interface AdbReverseWatcher {
  stop(): void;
}

/** Polls for connected Android devices and applies `adb reverse tcp:<port>`
 *  on each. Idempotent — adb just refreshes the mapping if it's already
 *  there. Lets a USB-attached phone reach `ws://localhost:<port>` without
 *  the developer running any command.
 *
 *  Silently no-ops when adb isn't installed (iOS / web users). */
export function startAdbReverseWatcher(
  port: number,
  intervalMs = 5000,
): AdbReverseWatcher {
  const adb = findAdb();
  if (!adb) {
    return { stop: () => undefined };
  }

  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  const applied = new Set<string>();

  const tick = async () => {
    if (stopped) return;
    const devices = await listDevices(adb);
    for (const id of devices) {
      // Re-apply on every tick the first time we see a device, then
      // periodically — handles `adb kill-server`, device unplug/replug,
      // and stale mappings without the developer noticing.
      const ok = await applyReverse(adb, id, port);
      if (ok) applied.add(id);
    }
    for (const id of applied) {
      if (!devices.includes(id)) applied.delete(id);
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };

  // Kick off immediately so devices already plugged in get reverse before
  // the user even hits "Run".
  void tick();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
