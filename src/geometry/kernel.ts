/**
 * Initialisierung des Manifold-3D-Geometriekernels (WASM).
 *
 * Manifold garantiert bei allen Booleschen Operationen geschlossene,
 * orientierte ("wasserdichte") Meshes – die Grundvoraussetzung für saubere STLs.
 */
import Module from 'manifold-3d';

export type ManifoldToplevel = Awaited<ReturnType<typeof Module>>;
export type Manifold = InstanceType<ManifoldToplevel['Manifold']>;

let kernelPromise: Promise<ManifoldToplevel> | null = null;

/**
 * Lädt den Kernel genau einmal.
 * @param wasmUrl Pfad zur manifold.wasm (im Browser via Vite `?url`, in Node nicht nötig).
 */
export function initKernel(wasmUrl?: string): Promise<ManifoldToplevel> {
  if (!kernelPromise) {
    kernelPromise = Module(wasmUrl ? { locateFile: () => wasmUrl } : undefined).then((wasm) => {
      wasm.setup();
      return wasm;
    });
  }
  return kernelPromise;
}

/**
 * Hilfsklasse zur Speicherverwaltung: Manifold-Objekte leben im WASM-Heap und
 * müssen explizit freigegeben werden. Alle Zwischenergebnisse werden hier
 * gesammelt und am Ende gemeinsam gelöscht.
 */
export class Scope {
  private items: Manifold[] = [];

  track<T extends Manifold>(m: T): T {
    this.items.push(m);
    return m;
  }

  /** Gibt alle Objekte frei, außer `keep`. */
  dispose(keep?: Manifold): void {
    for (const m of this.items) if (m !== keep) m.delete();
    this.items = [];
  }
}
