#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * `npx owlscope setup` — one-time bootstrap for a React Native project.
 *
 *   1. Patches every `ios/<App>/Info.plist` with the two keys iOS 14+
 *      requires for `ws://localhost:9090` traffic to work on a real
 *      device:
 *        • NSLocalNetworkUsageDescription
 *        • NSAppTransportSecurity → NSAllowsLocalNetworking
 *   2. Runs `adb reverse tcp:9090 tcp:9090` for every connected
 *      Android device, so a USB-attached phone can reach the Mac via
 *      `localhost`.
 *
 * Idempotent. Re-running it never duplicates plist keys; if `adb` is
 * missing or no Android device is plugged in, it just logs and moves on.
 *
 * Designed to be safe to commit into a project's setup workflow:
 *
 *   "scripts": {
 *     "postinstall": "owlscope setup --quiet"
 *   }
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const args = process.argv.slice(2);
const QUIET = args.includes('--quiet');
const SUBCMD = args.find((a) => !a.startsWith('--')) ?? 'setup';

function log(...m) {
  if (!QUIET) console.log('[owlscope]', ...m);
}
function warn(...m) {
  console.warn('[owlscope]', ...m);
}

// ──────────────────────────────────────────────────────────────────────
// iOS Info.plist patch
// ──────────────────────────────────────────────────────────────────────

function findInfoPlists(cwd) {
  const iosDir = path.join(cwd, 'ios');
  if (!fs.existsSync(iosDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(iosDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.endsWith('.xcodeproj') || entry.name.endsWith('.xcworkspace')) continue;
    if (entry.name === 'Pods' || entry.name.startsWith('.') || entry.name === 'build') continue;
    const candidate = path.join(iosDir, entry.name, 'Info.plist');
    if (fs.existsSync(candidate)) out.push(candidate);
  }
  return out;
}

function ensurePlistKey(content, key, valueXml) {
  if (content.includes(`<key>${key}</key>`)) return { content, modified: false };
  // Insert before closing root </dict>. Plist files end with `</dict>\n</plist>`.
  const insertion = `\t<key>${key}</key>\n\t${valueXml}\n`;
  const updated = content.replace(/<\/dict>\s*<\/plist>\s*$/m, `${insertion}</dict>\n</plist>\n`);
  return { content: updated, modified: updated !== content };
}

/** Find the index of the matching `</dict>` for an `<dict>` that starts
 *  at `start` (0-based, pointing at `<`). Tracks nested `<dict>...</dict>`
 *  pairs so we don't close on an inner one (eg. NSExceptionDomains). */
function findMatchingDictClose(content, start) {
  const open = '<dict>';
  const close = '</dict>';
  let i = start;
  let depth = 0;
  while (i < content.length) {
    const o = content.indexOf(open, i);
    const c = content.indexOf(close, i);
    if (c === -1) return -1;
    if (o !== -1 && o < c) {
      depth++;
      i = o + open.length;
    } else {
      depth--;
      if (depth === 0) return c;
      i = c + close.length;
    }
  }
  return -1;
}

function ensureAtsLocalNetworking(content) {
  if (content.includes('<key>NSAllowsLocalNetworking</key>')) {
    return { content, modified: false };
  }

  const atsKeyMatch = /<key>NSAppTransportSecurity<\/key>\s*<dict>/m.exec(content);
  if (atsKeyMatch) {
    const dictOpen = content.indexOf('<dict>', atsKeyMatch.index);
    if (dictOpen !== -1) {
      const matchingClose = findMatchingDictClose(content, dictOpen);
      if (matchingClose !== -1) {
        const insertion = `\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<true/>\n\t`;
        const updated =
          content.slice(0, matchingClose) + insertion + content.slice(matchingClose);
        return { content: updated, modified: true };
      }
    }
  }

  // No ATS dict — append a fresh one before the root closing tag.
  const insertion = `\t<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<true/>\n\t</dict>\n`;
  const updated = content.replace(/<\/dict>\s*<\/plist>\s*$/m, `${insertion}</dict>\n</plist>\n`);
  return { content: updated, modified: updated !== content };
}

function patchIos(cwd) {
  const plists = findInfoPlists(cwd);
  if (plists.length === 0) {
    log('no ios/ directory or Info.plist — skipping iOS patch');
    return;
  }
  for (const plist of plists) {
    let content = fs.readFileSync(plist, 'utf8');
    let touched = false;

    const r1 = ensurePlistKey(
      content,
      'NSLocalNetworkUsageDescription',
      '<string>OwlScope debugger connection</string>',
    );
    content = r1.content;
    touched = touched || r1.modified;

    const r2 = ensureAtsLocalNetworking(content);
    content = r2.content;
    touched = touched || r2.modified;

    if (touched) {
      fs.writeFileSync(plist, content);
      log(`patched ${path.relative(cwd, plist)}`);
    } else {
      log(`already configured: ${path.relative(cwd, plist)}`);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Android adb reverse
// ──────────────────────────────────────────────────────────────────────

function findAdb() {
  const candidates = [];
  if (process.env.ANDROID_HOME) candidates.push(path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb'));
  if (process.env.ANDROID_SDK_ROOT)
    candidates.push(path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb'));
  if (process.env.HOME) {
    candidates.push(path.join(process.env.HOME, 'Library', 'Android', 'sdk', 'platform-tools', 'adb'));
    candidates.push(path.join(process.env.HOME, 'Android', 'Sdk', 'platform-tools', 'adb'));
  }

  // PATH-resolvable `adb` first.
  try {
    const r = spawnSync('which', ['adb'], { encoding: 'utf8' });
    const onPath = r.stdout.trim();
    if (onPath && fs.existsSync(onPath)) return onPath;
  } catch (_) {
    // ignore
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function adbReverse() {
  const adb = findAdb();
  if (!adb) {
    log('adb not found — skip Android USB step (only emulator users need not worry)');
    return;
  }
  let devices = [];
  try {
    const out = execSync(`"${adb}" devices`, { encoding: 'utf8' });
    devices = out
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line && line.endsWith('\tdevice'))
      .map((line) => line.split('\t')[0]);
  } catch (e) {
    warn('adb devices failed:', e.message);
    return;
  }
  if (devices.length === 0) {
    log('no Android device attached — skip adb reverse (only needed for USB)');
    return;
  }
  for (const id of devices) {
    try {
      execSync(`"${adb}" -s ${id} reverse tcp:9090 tcp:9090`);
      log(`adb reverse OK on ${id}`);
    } catch (e) {
      warn(`adb reverse failed on ${id}:`, e.message);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────

function main() {
  const cwd = process.cwd();
  if (SUBCMD === 'reverse') {
    adbReverse();
    return;
  }
  if (SUBCMD === 'patch-ios') {
    patchIos(cwd);
    return;
  }
  if (SUBCMD === 'setup') {
    log('running setup…');
    patchIos(cwd);
    adbReverse();
    log('done. Now: import { startOwlScope } from "owlscope/rn"; startOwlScope({ name: "<app>" })');
    return;
  }
  console.error(`Unknown subcommand "${SUBCMD}". Try: setup | patch-ios | reverse`);
  process.exit(1);
}

main();
