#!/usr/bin/env node
/**
 * Extractor de tiempos para salidas de `docker buildx build --progress=plain`.
 *
 * Uso:
 *   node scripts/docker-timing.mjs <log> [--top=12] [--segments] [--stage=<nombre>]
 *
 * - Resume los pasos con su duración (DONE x.xs) y marca los cacheados.
 * - Con --segments, reconstruye sub-pasos a partir de los timestamps que
 *   BuildKit prefija en cada línea de salida (`#12 34.5 texto`).
 *
 * No modifica nada; solo lee el log.
 */
import fs from 'node:fs';
import path from 'node:path';

const rawArgs = process.argv.slice(2);
const files = rawArgs.filter((a) => !a.startsWith('--'));
const opts = Object.fromEntries(
  rawArgs
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v === undefined ? true : v];
    }),
);

if (files.length === 0) {
  console.error('Uso: node scripts/docker-timing.mjs <log> [--top=12] [--segments] [--stage=nombre]');
  process.exit(1);
}

const TOP = Number(opts.top || 12);
const SHOW_SEGMENTS = Boolean(opts.segments);
const STAGE_FILTER = opts.stage ? String(opts.stage) : null;

const HEADER_RE = /^#(\d+)\s(.*)$/;
const PROGRESS_RE = /^#(\d+)\s+([0-9]+(?:\.[0-9]+)?)\s(.*)$/;
const DONE_RE = /^#(\d+)\s+DONE\s+([0-9.]+)s\s*$/;
const CACHED_RE = /^#(\d+)\s+CACHED\s*$/;
const STAGE_RE = /^\[([^\]]+)\]\s*(.*)$/;

/**
 * Marcadores de interés. El orden importa poco: se ordenan por timestamp.
 * Cada entrada es [regex, etiqueta].
 */
const MARKERS = [
  [/preparing pnpm|corepack enable|corepack prepare/i, 'corepack/pnpm activate'],
  [/apt-get update|^Get:\d+|^Setting up |^Unpacking /i, 'apt-get'],
  [/pnpm fetch/i, 'pnpm fetch'],
  [/^Progress: resolved/i, 'pnpm resolve'],
  [/^Packages:\s*\+/i, 'pnpm link/add'],
  [/^> .+@[^ ]+ build\b/i, 'workspace build (pnpm)'],
  [/prisma generate/i, 'prisma generate'],
  [/prisma validate/i, 'prisma validate'],
  [/nest build/i, 'nest build'],
  [/next build/i, 'next build'],
  [/creating an optimized production build/i, 'next: create build'],
  [/linting and checking validity of types/i, 'next: typecheck+lint'],
  [/collecting page data/i, 'next: collect page data'],
  [/generating static pages/i, 'next: generate pages'],
  [/finalizing page optimization/i, 'next: finalize'],
  [/compiled successfully/i, 'nest: compiled'],
  [/exporting to image|exporting layers|writing image|naming to/i, 'image export'],
];

function readLog(file) {
  const buf = fs.readFileSync(file);
  // PowerShell Tee-Object/Out-File puede escribir UTF-16LE con BOM.
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf);
    for (let i = 0; i + 1 < swapped.length; i += 2) {
      const tmp = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = tmp;
    }
    return swapped.toString('utf16le');
  }
  return buf.toString('utf8');
}

function parseFile(file) {
  const text = readLog(file);
  const steps = new Map(); // id -> {id, descriptor, stage, done, cached, progress: []}
  let currentId = null;

  for (const line of text.split(/\r?\n/)) {
    let m;
    if ((m = PROGRESS_RE.exec(line))) {
      const id = Number(m[1]);
      const t = Number(m[2]);
      const body = m[3];
      const step = steps.get(id) || { id, progress: [] };
      step.progress.push({ t, text: body });
      steps.set(id, step);
      currentId = id;
      continue;
    }
    if ((m = DONE_RE.exec(line))) {
      const id = Number(m[1]);
      const step = steps.get(id) || { id };
      step.done = Number(m[2]);
      steps.set(id, step);
      currentId = null;
      continue;
    }
    if ((m = CACHED_RE.exec(line))) {
      const id = Number(m[1]);
      const step = steps.get(id) || { id };
      step.cached = true;
      steps.set(id, step);
      currentId = null;
      continue;
    }
    if ((m = HEADER_RE.exec(line))) {
      const id = Number(m[1]);
      const body = m[2].trim();
      if (!body) continue;
      const step = steps.get(id) || { id, progress: [] };
      const stageMatch = STAGE_RE.exec(body);
      if (stageMatch) {
        if (!step.stage) {
          step.stage = stageMatch[1];
          step.descriptor = stageMatch[2].trim();
        }
      } else if (!step.descriptor) {
        step.descriptor = body;
      }
      steps.set(id, step);
      currentId = id;
      continue;
    }
    // Línea de continuación del encabezado (BuildKit puede partir RUN largos)
    if (currentId != null && line.trim() && !line.startsWith('#')) {
      const step = steps.get(currentId);
      if (step && step.descriptor && !step.done) {
        step.descriptor += ' ' + line.trim();
      }
    }
  }

  return steps;
}

function cleanDescriptor(s) {
  return (s || '')
    .replace(/\s+/g, ' ')
    .replace(/^RUN\s+/i, '')
    .trim();
}

function stageOf(d) {
  if (!d) return '(desconocida)';
  // d = "deps 3/6" o "base"
  return d.replace(/\s+\d+\/\d+$/, '').trim();
}

function segmentsFor(step) {
  // Eventos: inicio (t=0) + primera línea de cada marcador.
  const events = [{ t: 0, label: 'inicio' }];
  const seen = new Set();
  for (const p of step.progress) {
    for (const [re, label] of MARKERS) {
      if (re.test(p.text) && !seen.has(label)) {
        seen.add(label);
        events.push({ t: p.t, label });
        break;
      }
    }
  }
  const last = step.progress.length ? step.progress[step.progress.length - 1].t : (step.done || 0);
  events.push({ t: step.done ?? last, label: 'fin' });
  events.sort((a, b) => a.t - b.t);
  const out = [];
  for (let i = 1; i < events.length; i++) {
    const dt = events[i].t - events[i - 1].t;
    if (dt >= 0.05) out.push({ from: events[i - 1].label, to: events[i].label, t: events[i].t, dt });
  }
  return out;
}

for (const file of files) {
  const steps = parseFile(file);
  let rows = [...steps.values()].filter((s) => s.done != null || s.cached);
  if (STAGE_FILTER) {
    rows = rows.filter((s) => stageOf(s.stage).toLowerCase() === STAGE_FILTER.toLowerCase());
  }

  const executed = rows
    .filter((s) => s.done != null && !s.cached)
    .sort((a, b) => b.done - a.done);
  const cached = rows.filter((s) => s.cached);

  console.log(`\n=== ${path.basename(file)} ===`);
  console.log(`Pasos ejecutados: ${executed.length} | cacheados: ${cached.length}`);
  console.log('');
  console.log('Top pasos por duración:');
  console.log('  dur(s)  etapa        paso');
  console.log('  ------  -----------  ------------------------------------------------------------');
  for (const s of executed.slice(0, TOP)) {
    const stage = stageOf(s.stage).padEnd(11).slice(0, 11);
    console.log(`  ${String(s.done.toFixed(2)).padStart(6)}  ${stage}  ${cleanDescriptor(s.descriptor).slice(0, 120)}`);
  }

  const total = executed.reduce((a, s) => a + s.done, 0);
  console.log('');
  console.log(`Suma de pasos ejecutados: ${total.toFixed(2)} s (puede solapar etapas en paralelo)`);

  if (SHOW_SEGMENTS) {
    console.log('\nSub-pasos (estimados por timestamps de BuildKit):');
    const interesting = executed.filter((s) => s.progress.length > 0).slice(0, TOP);
    for (const s of interesting) {
      const segs = segmentsFor(s).filter((x) => x.dt >= 0.3);
      if (segs.length === 0) continue;
      console.log(`\n  #${s.id} [${stageOf(s.stage)}] ${cleanDescriptor(s.descriptor).slice(0, 100)}  (total ${s.done.toFixed(2)} s)`);
      for (const seg of segs) {
        console.log(`    ${String(seg.dt.toFixed(2)).padStart(7)} s  ${seg.from} -> ${seg.to}  (@${seg.t.toFixed(2)}s)`);
      }
    }
  }

  if (cached.length) {
    console.log('\nPasos cacheados:');
    for (const s of cached.slice(0, 40)) {
      console.log(`  #${s.id} [${stageOf(s.stage)}] ${cleanDescriptor(s.descriptor).slice(0, 110)}`);
    }
  }
}
