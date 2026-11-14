/// <reference lib="webworker" />
/**
 * Web Worker: führt alle Geometrie-Berechnungen abseits des UI-Threads aus.
 *
 * - Ergebnisse werden pro Teil gecacht (Schlüssel = alle geometrierelevanten
 *   Parameter), sodass bei einer Änderung nur betroffene Teile neu entstehen.
 * - Jedes Teil wird beim Bauen als Binär-STL geschrieben, wieder eingelesen und
 *   auf Wasserdichtheit geprüft; das Ergebnis erscheint in der UI.
 */
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { zipSync } from 'fflate';
import { buildPart, type PartResult } from '../geometry/build';
import { initKernel } from '../geometry/kernel';
import { assemblyHtml, assemblySvg } from '../geometry/assembly';
import { usableHeight } from '../geometry/dimensions';
import { computeLayout, moduleAvail } from '../geometry/layout';
import { groundInstances, labelText, listParts } from '../geometry/parts';
import { fileNameFor, serializeProject, uniqueFileNames } from '../geometry/project';
import { loadAllFonts } from '../geometry/text';
import { checkWatertight, parseBinaryStl, writeBinaryStl } from '../geometry/stl';
import type { PartSpec, Project } from '../geometry/types';
import type { ExportedFile, PartPreview, WorkerRequest, WorkerResponse } from './protocol';

interface CacheEntry {
  part: PartResult;
  stl: ArrayBuffer;
  watertight: boolean;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE = 96;

function cacheKey(spec: PartSpec, p: Project): string {
  const { name: _n, quantity: _q, note: _note, ...specGeom } = spec;
  const m = p.modules.find((x) => x.id === spec.moduleId);
  let mod: unknown = null;
  if (m) {
    const { name: _mn, quantity: _mq, id: _id, placement, level: _lv, ...rest } = m;
    // Höhe „bis Deckel“ hängt von der Lage ab; der Name ist ggf. die Beschriftung.
    mod = { ...rest, rotated: placement.rotated, avail: m.heightMode === 'fill' ? moduleAvail(m, p) : 0, text: labelText(m) };
  }
  const ground = spec.kind === 'baseplate' ? groundInstances(p).map((i) => [i.x, i.y, i.width, i.depth]) : null;
  const { printer: _pr, ...print } = p.print;
  return JSON.stringify([specGeom, mod, print, p.box, p.grid, p.baseplate, p.labels, ground]);
}

let fontsReady: Promise<void> | null = null;

async function getPart(spec: PartSpec, p: Project): Promise<CacheEntry> {
  const key = cacheKey(spec, p);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit); // LRU: ans Ende verschieben
    return hit;
  }
  const k = await initKernel(wasmUrl);
  await (fontsReady ??= loadAllFonts());
  const part = buildPart(k, spec, p);
  const stl = writeBinaryStl(part.mesh, `BG-Insert-Konfigurator: ${spec.name}`);
  const watertight = part.status === 'NoError' && checkWatertight(parseBinaryStl(stl)).watertight;
  const entry = { part, stl, watertight };
  cache.set(key, entry);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  return entry;
}

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    const specs = listParts(req.project);
    if (req.type === 'build') {
      const parts: PartPreview[] = [];
      for (const spec of specs) {
        try {
          const e = await getPart(spec, req.project);
          parts.push({
            partId: spec.id,
            positions: e.part.mesh.positions.slice(),
            indices: e.part.mesh.indices.slice(),
            volume: e.part.volume,
            triangles: e.part.mesh.indices.length / 3,
            watertight: e.watertight,
          });
        } catch (err) {
          parts.push({
            partId: spec.id,
            positions: new Float32Array(),
            indices: new Uint32Array(),
            volume: 0,
            triangles: 0,
            watertight: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      post({ type: 'built', reqId: req.reqId, parts }, parts.flatMap((x) => [x.positions.buffer, x.indices.buffer]));
      return;
    }

    const chosen = req.type === 'exportPart' ? specs.filter((s) => s.id === req.partId) : specs;
    if (chosen.length === 0) throw new Error('Keine Teile zum Exportieren.');
    const names = uniqueFileNames(chosen.map((s) => fileNameFor(s.name, s.quantity)));
    const files: ExportedFile[] = [];
    const entries: CacheEntry[] = [];
    for (let i = 0; i < chosen.length; i++) {
      const e = await getPart(chosen[i], req.project);
      entries.push(e);
      files.push({ partId: chosen[i].id, name: names[i], watertight: e.watertight });
    }

    if (req.type === 'exportPart') {
      const data = entries[0].stl.slice(0);
      post({ type: 'exported', reqId: req.reqId, fileName: names[0], data, mime: 'model/stl', files }, [data]);
      return;
    }

    const zipInput: Record<string, Uint8Array> = {};
    names.forEach((n, i) => (zipInput[n] = new Uint8Array(entries[i].stl)));
    const enc = new TextEncoder();
    zipInput['projekt.json'] = enc.encode(serializeProject(req.project));
    const layout = computeLayout(req.project);
    zipInput['Einraeumanleitung.html'] = enc.encode(assemblyHtml(req.project, layout));
    zipInput['Explosionszeichnung.svg'] = enc.encode(assemblySvg(req.project, layout, { explode: Math.max(20, usableHeight(req.project.box) * 0.35), width: 1200 }));
    const zipped = zipSync(zipInput, { level: 6 });
    const data = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
    const safe = (req.project.name || 'Insert').replace(/[^A-Za-z0-9._-]+/g, '_');
    post({ type: 'exported', reqId: req.reqId, fileName: `${safe}_STL.zip`, data, mime: 'application/zip', files }, [data]);
  } catch (err) {
    post({ type: 'error', reqId: req.reqId, message: err instanceof Error ? err.message : String(err) });
  }
};
