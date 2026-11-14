/**
 * Druckerprofile mit nutzbarem Bauraum (Herstellerangaben, X × Y × Z in mm).
 * Neue Drucker einfach hier ergänzen.
 */
export interface PrinterPreset {
  id: string;
  label: string;
  bedX: number;
  bedY: number;
  bedZ: number;
}

export const PRINTERS: readonly PrinterPreset[] = [
  { id: 'bambu-h3c', label: 'Bambu Lab H3C', bedX: 330, bedY: 320, bedZ: 325 },
  { id: 'bambu-h2s', label: 'Bambu Lab H2S', bedX: 340, bedY: 320, bedZ: 340 },
  { id: 'bambu-h2d', label: 'Bambu Lab H2D', bedX: 325, bedY: 320, bedZ: 325 },
  { id: 'bambu-x1', label: 'Bambu Lab X1C / X1E', bedX: 256, bedY: 256, bedZ: 256 },
  { id: 'bambu-p2s', label: 'Bambu Lab P2S', bedX: 256, bedY: 256, bedZ: 256 },
  { id: 'bambu-p1', label: 'Bambu Lab P1S / P1P', bedX: 256, bedY: 256, bedZ: 256 },
  { id: 'bambu-a1', label: 'Bambu Lab A1', bedX: 256, bedY: 256, bedZ: 256 },
  { id: 'bambu-a1mini', label: 'Bambu Lab A1 mini', bedX: 180, bedY: 180, bedZ: 180 },
  { id: 'prusa-core-one', label: 'Prusa CORE One', bedX: 250, bedY: 220, bedZ: 270 },
  { id: 'prusa-mk4', label: 'Prusa MK4S / MK3S+', bedX: 250, bedY: 210, bedZ: 220 },
  { id: 'prusa-xl', label: 'Prusa XL', bedX: 360, bedY: 360, bedZ: 360 },
  { id: 'prusa-mini', label: 'Prusa MINI+', bedX: 180, bedY: 180, bedZ: 180 },
  { id: 'creality-k1', label: 'Creality K1 / K1C', bedX: 220, bedY: 220, bedZ: 250 },
  { id: 'creality-k1max', label: 'Creality K1 Max', bedX: 300, bedY: 300, bedZ: 300 },
  { id: 'creality-ender3v3', label: 'Creality Ender-3 V3', bedX: 220, bedY: 220, bedZ: 250 },
  { id: 'elegoo-centauri', label: 'Elegoo Centauri Carbon', bedX: 256, bedY: 256, bedZ: 256 },
  { id: 'voron-350', label: 'Voron 2.4 (350)', bedX: 350, bedY: 350, bedZ: 340 },
];

export function printerPreset(id: string): PrinterPreset | undefined {
  return PRINTERS.find((p) => p.id === id);
}

/** Sicherheitsrand zum Druckbettrand (Skirt/Brim). */
export const BED_MARGIN = 4;

/** Passt ein Teil (B × T × H) aufs Druckbett? Drehung um 90° ist erlaubt. */
export function fitsBed(w: number, d: number, h: number, bed: { bedX: number; bedY: number; bedZ: number }): boolean {
  const X = bed.bedX - BED_MARGIN;
  const Y = bed.bedY - BED_MARGIN;
  const flat = (w <= X + 1e-6 && d <= Y + 1e-6) || (w <= Y + 1e-6 && d <= X + 1e-6);
  return flat && h <= bed.bedZ + 1e-6;
}
