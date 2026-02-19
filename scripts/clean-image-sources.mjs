#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = {
    maxMB: 1.5,
    concurrency: 12,
    write: false,
    strictUnknown: false,
    noCache: false,
    cachePath: path.resolve('.cache/image-source-audit.json'),
    timeoutMs: 12000
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--write') args.write = true;
    else if (a === '--strict-unknown') args.strictUnknown = true;
    else if (a === '--no-cache') args.noCache = true;
    else if (a === '--maxMB') args.maxMB = Number(argv[++i]);
    else if (a === '--concurrency') args.concurrency = Number(argv[++i]);
    else if (a === '--timeoutMs') args.timeoutMs = Number(argv[++i]);
    else if (a === '--cache') args.cachePath = path.resolve(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
    else {
      console.error(`Unknown arg: ${a}`);
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`\nUsage:\n  node scripts/clean-image-sources.mjs [options]\n\nOptions:\n  --maxMB <number>        Max allowed size in MB (default 1.5)\n  --concurrency <number>  Parallel requests (default 12)\n  --timeoutMs <number>    Per-request timeout (default 12000)\n  --write                 Rewrite source files with filtered lists\n  --strict-unknown        Remove URLs when size is unknown\n  --cache <path>          Cache file path (default .cache/image-source-audit.json)\n  --no-cache              Disable cache\n\nWhat it does:\n  - Checks each URL with HEAD (falls back to GET Range: bytes=0-0)\n  - Removes broken URLs (non-2xx)\n  - Removes URLs larger than --maxMB\n  - (Optional) rewrites zigguratssSources.js and zigguratssLandscapeSources.js\n`);
}

async function ensureCacheDir(cachePath) {
  const dir = path.dirname(cachePath);
  await fs.promises.mkdir(dir, { recursive: true });
}

async function loadCache(cachePath) {
  try {
    const raw = await fs.promises.readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { byUrl: {}, meta: {} };
    return {
      byUrl: parsed.byUrl && typeof parsed.byUrl === 'object' ? parsed.byUrl : {},
      meta: parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}
    };
  } catch {
    return { byUrl: {}, meta: {} };
  }
}

async function saveCache(cachePath, cache) {
  await ensureCacheDir(cachePath);
  await fs.promises.writeFile(cachePath, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function fetchHeadOrRange(url, timeoutMs) {
  const headers = {
    // Some servers behave better with a UA.
    'user-agent': 'react-art-gallery-source-audit/1.0'
  };

  // 1) Try HEAD
  try {
    const res = await withTimeout(fetch(url, { method: 'HEAD', redirect: 'follow', headers }), timeoutMs, `HEAD ${url}`);
    if (res.ok) return res;

    // Some servers return 403 for HEAD but allow GET.
    if (res.status === 405 || res.status === 403) {
      // fall through
    } else {
      return res;
    }
  } catch {
    // fall through to range
  }

  // 2) Range GET minimal
  const rangeHeaders = { ...headers, range: 'bytes=0-0' };
  const res2 = await withTimeout(fetch(url, { method: 'GET', redirect: 'follow', headers: rangeHeaders }), timeoutMs, `RANGE ${url}`);
  return res2;
}

function parseSizeFromHeaders(res) {
  const len = res.headers.get('content-length');
  if (len && /^\d+$/.test(len)) return Number(len);

  // If we used Range GET, content-range may be present: bytes 0-0/4951204
  const cr = res.headers.get('content-range');
  if (cr) {
    const m = cr.match(/\/([0-9]+)\s*$/);
    if (m) return Number(m[1]);
  }

  return null;
}

function normalizeUrl(u) {
  return String(u ?? '').trim();
}

async function auditUrl(url, { timeoutMs, cache, cacheTtlMs }) {
  const cached = cache?.byUrl?.[url];
  if (cached && typeof cached === 'object') {
    if (Date.now() - (cached.ts ?? 0) < cacheTtlMs) return cached;
  }

  const record = {
    ts: Date.now(),
    url,
    ok: false,
    status: 0,
    contentType: null,
    bytes: null,
    error: null
  };

  try {
    const res = await fetchHeadOrRange(url, timeoutMs);
    record.status = res.status;
    record.ok = res.ok;
    record.contentType = res.headers.get('content-type');
    record.bytes = parseSizeFromHeaders(res);
  } catch (e) {
    record.error = e?.message ?? String(e);
  }

  if (cache) cache.byUrl[url] = record;
  return record;
}

function formatBytes(bytes) {
  if (bytes == null) return 'unknown';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function renderExportArray({ exportName, urls }) {
  const lines = [];
  lines.push(`export const ${exportName} = [`);
  for (const u of urls) {
    lines.push(`  ${JSON.stringify(u)},`);
  }
  lines.push('];\n');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!globalThis.fetch) {
    console.error('This script requires Node 18+ (fetch not found).');
    process.exit(1);
  }

  const maxBytes = Math.floor((args.maxMB || 1.5) * 1024 * 1024);
  const concurrency = Math.max(1, Number(args.concurrency) || 12);

  const rootDir = path.resolve(__dirname, '..');
  const sourcesFile = path.join(rootDir, 'zigguratssSources.js');
  const landscapeFile = path.join(rootDir, 'zigguratssLandscapeSources.js');

  const sourcesMod = await import(pathToFileURL(sourcesFile));
  const landscapeMod = await import(pathToFileURL(landscapeFile));

  const sources = Array.isArray(sourcesMod.zigguratssArtworkSources) ? sourcesMod.zigguratssArtworkSources.map(normalizeUrl) : [];
  const landscape = Array.isArray(landscapeMod.zigguratssLandscapeSources) ? landscapeMod.zigguratssLandscapeSources.map(normalizeUrl) : [];

  const allUnique = Array.from(new Set([...sources, ...landscape].filter(Boolean)));

  const cacheTtlMs = 1000 * 60 * 60 * 24 * 30; // 30 days
  const cache = args.noCache ? null : await loadCache(args.cachePath);

  console.log(`Auditing ${allUnique.length} unique URLs...`);
  console.log(`- max size: ${args.maxMB} MB`);
  console.log(`- concurrency: ${concurrency}`);
  console.log(`- write: ${args.write ? 'yes' : 'no'}`);

  const removed = new Map(); // url -> reason
  const byUrl = new Map(); // url -> record

  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < allUnique.length) {
      const url = allUnique[cursor++];
      const record = await auditUrl(url, {
        timeoutMs: args.timeoutMs,
        cache,
        cacheTtlMs
      });

      byUrl.set(url, record);

      if (!record.ok) {
        removed.set(url, `HTTP ${record.status || 'ERR'}`);
        continue;
      }

      const ct = String(record.contentType ?? '');
      if (ct && !ct.startsWith('image/')) {
        removed.set(url, `Not image (${ct})`);
        continue;
      }

      if (record.bytes == null) {
        if (args.strictUnknown) removed.set(url, 'Unknown size');
        continue;
      }

      if (record.bytes > maxBytes) {
        removed.set(url, `Too large (${formatBytes(record.bytes)})`);
      }
    }
  });

  await Promise.all(workers);

  if (cache) {
    cache.meta = { ...cache.meta, updatedAt: new Date().toISOString() };
    await saveCache(args.cachePath, cache);
  }

  const keepSet = new Set(allUnique.filter((u) => !removed.has(u)));

  const keptCount = keepSet.size;
  const removedCount = removed.size;
  console.log(`\nResult:`);
  console.log(`- kept: ${keptCount}`);
  console.log(`- removed: ${removedCount}`);

  const topRemoved = Array.from(removed.entries()).slice(0, 20);
  if (topRemoved.length) {
    console.log(`\nSample removed (first ${topRemoved.length}):`);
    for (const [url, reason] of topRemoved) {
      console.log(`- ${reason}: ${url}`);
    }
  }

  if (!args.write) {
    console.log(`\nDry run only. To rewrite files: node scripts/clean-image-sources.mjs --write --maxMB ${args.maxMB}`);
    process.exit(0);
  }

  // Rewrite keeping original order per file
  const newSources = sources.filter((u) => keepSet.has(u));
  const newLandscape = landscape.filter((u) => keepSet.has(u));

  await fs.promises.writeFile(
    sourcesFile,
    renderExportArray({ exportName: 'zigguratssArtworkSources', urls: newSources }),
    'utf8'
  );

  await fs.promises.writeFile(
    landscapeFile,
    renderExportArray({ exportName: 'zigguratssLandscapeSources', urls: newLandscape }),
    'utf8'
  );

  console.log(`\nWrote:`);
  console.log(`- ${path.relative(rootDir, sourcesFile)} (${newSources.length} urls)`);
  console.log(`- ${path.relative(rootDir, landscapeFile)} (${newLandscape.length} urls)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
