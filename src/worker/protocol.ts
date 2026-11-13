/** Nachrichtenformat zwischen UI und Geometrie-Worker. */
import type { Project } from '../geometry/types';

export interface PartPreview {
  moduleId: string;
  positions: Float32Array;
  indices: Uint32Array;
  volume: number;
  triangles: number;
  watertight: boolean;
  error?: string;
}

export interface ExportedFile {
  moduleId: string;
  name: string;
  watertight: boolean;
}

export type WorkerRequest =
  | { type: 'build'; reqId: number; project: Project }
  | { type: 'exportZip'; reqId: number; project: Project }
  | { type: 'exportPart'; reqId: number; project: Project; moduleId: string };

export type WorkerResponse =
  | { type: 'built'; reqId: number; parts: PartPreview[] }
  | { type: 'exported'; reqId: number; fileName: string; data: ArrayBuffer; mime: string; files: ExportedFile[] }
  | { type: 'error'; reqId: number; message: string };
