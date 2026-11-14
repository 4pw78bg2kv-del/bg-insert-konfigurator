/**
 * Promise-basierte Schnittstelle zum Geometrie-Worker.
 */
import type { Project } from '../geometry/types';
import type { WorkerRequest, WorkerResponse } from './protocol';

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void };

class GeometryClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor() {
    this.worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(ev.data.reqId);
      if (!p) return;
      this.pending.delete(ev.data.reqId);
      if (ev.data.type === 'error') p.reject(new Error(ev.data.message));
      else p.resolve(ev.data);
    };
    this.worker.onerror = (ev) => {
      for (const p of this.pending.values()) p.reject(new Error(ev.message || 'Geometrie-Worker abgestürzt'));
      this.pending.clear();
    };
  }

  private send<T extends WorkerResponse['type']>(
    req: Omit<WorkerRequest, 'reqId'>,
  ): Promise<Extract<WorkerResponse, { type: T }>> {
    const reqId = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve: resolve as (r: WorkerResponse) => void, reject });
      this.worker.postMessage({ ...req, reqId } as WorkerRequest);
    });
  }

  build(project: Project) {
    return this.send<'built'>({ type: 'build', project });
  }

  exportZip(project: Project) {
    return this.send<'exported'>({ type: 'exportZip', project });
  }

  exportPart(project: Project, partId: string) {
    return this.send<'exported'>({ type: 'exportPart', project, partId } as Omit<WorkerRequest, 'reqId'>);
  }
}

let client: GeometryClient | null = null;
export function geometryClient(): GeometryClient {
  return (client ??= new GeometryClient());
}

export function downloadBlob(data: ArrayBuffer | Uint8Array | string, fileName: string, mime: string) {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
