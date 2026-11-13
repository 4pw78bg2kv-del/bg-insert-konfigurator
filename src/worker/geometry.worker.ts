/// <reference lib="webworker" />
/**
 * Web Worker: führt alle Geometrie-Berechnungen abseits des UI-Threads aus.
 *
 * - Ergebnisse werden pro Modul gecacht (Schlüssel = Modulparameter + relevante
 *   globale Einstellungen), sodass bei einer Änderung nur betroffene Teile
 *   neu berechnet werden.
 * - Jedes Teil wird beim Bauen als Binär-STL geschrieben, wieder eingelesen und
 *   auf Wasserdichtheit geprüft; das Ergebnis erscheint in der UI.
 */
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { zipSync } from 'fflate';
import { buildPart, type PartResult } from '../geometry/build';
import { initKernel } from '../geometry/kernel';
import { partFileName, uniqueFileNames } from '../geometry/project';
import { checkWatertight, parseBinaryStl, writeBinaryStl } from '../geometry/stl';
import type { InsertModule, Project } from '../geometry/types';
import type { ExportedFile, PartPreview, WorkerRequest, WorkerResponse } from './protocol';

interface CacheEntry {
  part: PartResult;
  stl: ArrayBuffer;
  watertight: boolean;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE = 64;

function cacheKey(m: InsertModule, project: Project): string {
  // Platzierung, Name und Stückzahl beeinflussen die Geometrie nicht.
  const { placement: _p, name: _n, quantity: _q, id: _i, ...geom } = m;
  return JSON.stringify([geom, project.print, project.box.innerHeight, project.box.headroom]);
}

async function getPart(m: InsertModule, project: Project): Promise<CacheEntry> {
  const key = cacheKey(m, project);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit); // LRU: ans Ende verschieben
    return hit;
  }
  const k = await initKernel(wasmUrl);
  const part = buildPart(k, m, project);
  const stl = writeBinaryStl(part.mesh, `BG-Insert-Konfigurator: ${m.name}`);
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
    if (req.type === 'build') {
      const parts: PartPreview[] = [];
      for (const m of req.project.modules) {
        try {
          const e = await getPart(m, req.project);
          parts.push({
            moduleId: m.id,
            // Kopien senden, damit der Cache seine Daten behält.
            positions: e.part.mesh.positions.slice(),
            indices: e.part.mesh.indices.slice(),
            volume: e.part.volume,
            triangles: e.part.mesh.indices.length / 3,
            watertight: e.watertight,
          });
        } catch (err) {
          parts.push({
            moduleId: m.id,
            positions: new Float32Array(),
            indices: new Uint32Array(),
            volume: 0,
            triangles: 0,
            watertight: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      post({ type: 'built', reqId: req.reqId, parts }, parts.flatMap((p) => [p.positions.buffer, p.indices.buffer]));
      return;
    }

    const modules =
      req.type === 'exportPart' ? req.project.modules.filter((m) => m.id === req.moduleId) : req.project.modules;
    if (modules.length === 0) throw new Error('Keine Teile zum Exportieren.');
    const names = uniqueFileNames(modules.map(partFileName));
    const files: ExportedFile[] = [];
    const entries: CacheEntry[] = [];
    for (let i = 0; i < modules.length; i++) {
      const e = await getPart(modules[i], req.project);
      entries.push(e);
      files.push({ moduleId: modules[i].id, name: names[i], watertight: e.watertight });
    }

    if (req.type === 'exportPart') {
      const data = entries[0].stl.slice(0);
      post({ type: 'exported', reqId: req.reqId, fileName: names[0], data, mime: 'model/stl', files }, [data]);
      return;
    }

    const zipInput: Record<string, Uint8Array> = {};
    names.forEach((n, i) => (zipInput[n] = new Uint8Array(entries[i].stl)));
    zipInput['projekt.json'] = new TextEncoder().encode(JSON.stringify(req.project, null, 2));
    const zipped = zipSync(zipInput, { level: 6 });
    const data = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
    const safe = (req.project.name || 'Insert').replace(/[^A-Za-z0-9._-]+/g, '_');
    post({ type: 'exported', reqId: req.reqId, fileName: `${safe}_STL.zip`, data, mime: 'application/zip', files }, [data]);
  } catch (err) {
    post({ type: 'error', reqId: req.reqId, message: err instanceof Error ? err.message : String(err) });
  }
};
