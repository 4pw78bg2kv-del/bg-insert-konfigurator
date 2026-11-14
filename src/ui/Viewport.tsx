/**
 * Interaktive 3D-Vorschau (react-three-fiber).
 *
 * Die Geometrie liegt in Druckkoordinaten vor (Z oben). Die gesamte Szene wird
 * deshalb um -90° um X gedreht, damit sie in der Y-oben-Welt von Three.js
 * richtig steht.
 */
import { GizmoHelper, GizmoViewport, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { listParts, scenePlacements, usableHeight, type PlacedInstance, type ScenePlacement } from '../geometry';
import { useStore } from '../state/store';
import type { PartPreview } from '../worker/protocol';

const PALETTE = ['#e08a3c', '#4f9dde', '#6cbf6a', '#c770c9', '#e0c23c', '#5ac7c0', '#e0605c', '#9a8cf0'];
const DEG = Math.PI / 180;

function useGeometries(parts: Record<string, PartPreview>) {
  return useMemo(() => {
    const map = new Map<string, THREE.BufferGeometry>();
    for (const [id, part] of Object.entries(parts)) {
      if (part.triangles === 0) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
      g.setIndex(new THREE.BufferAttribute(part.indices, 1));
      g.computeBoundingBox();
      map.set(id, g);
    }
    return map;
  }, [parts]);
}

/** Kantenlinien (einfache GL-Linien, robust auf allen Grafiktreibern). */
function EdgeLines({ geometry, color, threshold = 20 }: { geometry: THREE.BufferGeometry; color: string; threshold?: number }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, threshold), [geometry, threshold]);
  return (
    <lineSegments geometry={edges} raycast={() => null}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}

/** Kanten eines Quaders (für Schachtel und Kopfraum). */
function BoxEdges({ args, color }: { args: [number, number, number]; color: string }) {
  const g = useMemo(() => new THREE.BoxGeometry(...args), [args[0], args[1], args[2]]);
  return <EdgeLines geometry={g} color={color} threshold={1} />;
}

function PartMesh({
  geometry,
  color,
  selected,
  opacity = 1,
  onSelect,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  selected: boolean;
  opacity?: number;
  onSelect?: () => void;
}) {
  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={(e) => {
        if (!onSelect) return;
        e.stopPropagation();
        onSelect();
      }}
    >
      <meshStandardMaterial
        color={color}
        flatShading
        roughness={0.65}
        metalness={0.05}
        transparent={opacity < 1}
        opacity={opacity}
        emissive={selected ? '#ffffff' : '#000000'}
        emissiveIntensity={selected ? 0.18 : 0}
      />
      <EdgeLines geometry={geometry} color={selected ? '#ffffff' : '#1d1d1d'} />
    </mesh>
  );
}

function Placed({ pl, children, dz }: { pl: ScenePlacement; children: React.ReactNode; dz: number }) {
  // Drehung um Z: (x, y) → (−y, x); danach um die Footprint-Breite verschieben.
  const pos: [number, number, number] = [pl.x + (pl.rotated ? pl.width : 0), pl.y, pl.z + dz];
  return (
    <group position={pos} rotation={[0, 0, pl.rotated ? Math.PI / 2 : 0]}>
      {pl.local ? (
        <group position={[pl.local.x, pl.local.y, pl.local.z]} rotation={[pl.local.rx * DEG, 0, 0]}>
          {children}
        </group>
      ) : (
        children
      )}
    </group>
  );
}

function OuterBox() {
  const box = useStore((s) => s.project.box);
  const usable = usableHeight(box);
  const W = box.innerWidth;
  const D = box.innerDepth;
  const H = box.innerHeight;
  const t = box.wallThickness;
  const f = box.floorThickness;
  return (
    <group>
      <mesh position={[W / 2, D / 2, (H - f) / 2]} renderOrder={10}>
        <boxGeometry args={[W + 2 * t, D + 2 * t, H + f]} />
        <meshStandardMaterial color="#b9a27c" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
        <BoxEdges args={[W + 2 * t, D + 2 * t, H + f]} color="#8a7350" />
      </mesh>
      {box.headroom > 0 && (
        <mesh position={[W / 2, D / 2, usable]} renderOrder={11}>
          <planeGeometry args={[W, D]} />
          <meshBasicMaterial color="#e05c5c" transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
          <BoxEdges args={[W, D, 0.01]} color="#e05c5c" />
        </mesh>
      )}
    </group>
  );
}

export function Viewport({ layout }: { layout: PlacedInstance[] }) {
  const project = useStore((s) => s.project);
  const parts = useStore((s) => s.parts);
  const selectedId = useStore((s) => s.selectedId);
  const viewMode = useStore((s) => s.viewMode);
  const showBox = useStore((s) => s.showBox);
  const explode = useStore((s) => s.explode);
  const select = useStore((s) => s.select);
  const { box } = project;
  const geometries = useGeometries(parts);

  const colorOf = useMemo(() => {
    const map = new Map(project.modules.map((m, i) => [m.id, PALETTE[i % PALETTE.length]]));
    return (pl: { partId: string; moduleId?: string }) => {
      if (pl.partId.startsWith('baseplate:')) return '#6b7280';
      if (pl.partId.includes(':div:')) return '#e9e4da';
      if (pl.partId.endsWith(':inlay') || pl.partId.endsWith(':lidInlay')) return '#f5f3ee';
      const c = map.get(pl.moduleId ?? '') ?? '#999';
      return pl.partId.endsWith(':lid') ? new THREE.Color(c).offsetHSL(0, -0.1, 0.12).getStyle() : c;
    };
  }, [project.modules]);

  const levelView = useStore((s) => s.levelView);
  const placements = useMemo(() => scenePlacements(project, layout), [project, layout]);
  const extent = Math.max(box.innerWidth, box.innerDepth, box.innerHeight);

  // Einzelteil-Ansicht: alle STL-Teile des gewählten Moduls in Druckorientierung nebeneinander
  const singleModule = viewMode === 'single' ? project.modules.find((m) => m.id === selectedId) ?? project.modules[0] : undefined;
  const singleParts = singleModule ? listParts(project).filter((p) => p.moduleId === singleModule.id) : [];
  let offset = 0;
  const singleItems = singleParts.flatMap((spec) => {
    const g = geometries.get(spec.id);
    if (!g?.boundingBox) return [];
    const x = offset;
    offset += g.boundingBox.max.x - g.boundingBox.min.x + 10;
    return [{ spec, g, x }];
  });
  const singleDepth = Math.max(0, ...singleItems.map((i) => i.g.boundingBox!.max.y));

  const center: [number, number, number] = singleModule
    ? [-(offset - 10) / 2, -singleDepth / 2, 0]
    : [-box.innerWidth / 2, -box.innerDepth / 2, 0];

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: [extent * 0.9, extent * 0.85, extent * 1.1], fov: 40, near: 1, far: extent * 20 }}
      onPointerMissed={() => select(null)}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <color attach="background" args={['#1f2328']} />
      <hemisphereLight args={['#ffffff', '#3a3a3a', 0.9]} />
      <directionalLight position={[extent, extent * 1.5, extent * 0.7]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-extent, extent * 0.5, -extent]} intensity={0.4} />

      <group rotation={[-Math.PI / 2, 0, 0]}>
        <group position={center}>
          {singleModule ? (
            singleItems.map(({ spec, g, x }) => (
              <group key={spec.id} position={[x, 0, 0]}>
                <PartMesh geometry={g} color={colorOf({ partId: spec.id, moduleId: spec.moduleId })} selected={false} />
              </group>
            ))
          ) : (
            <>
              {placements.map((pl) => {
                if (levelView > 0 && pl.level > levelView) return null;
                const g = geometries.get(pl.partId);
                if (!g) return null;
                const isLid = pl.partId.endsWith(':lid') || pl.partId.endsWith(':lidInlay');
                const dz = Math.max(0, pl.level - 1) * explode + (isLid ? explode * 0.6 : 0);
                const isSel = !!pl.moduleId && pl.moduleId === selectedId;
                return (
                  <Placed key={pl.key} pl={pl} dz={dz}>
                    <PartMesh
                      geometry={g}
                      color={colorOf(pl)}
                      selected={isSel && !pl.partId.includes(':')}
                      opacity={levelView > 0 && pl.level < levelView && pl.level > 0 ? 0.35 : 1}
                      onSelect={pl.moduleId ? () => select(pl.moduleId!) : undefined}
                    />
                  </Placed>
                );
              })}
              {showBox && explode === 0 && <OuterBox />}
            </>
          )}
        </group>
      </group>

      <gridHelper
        args={[Math.ceil((extent * 4) / 50) * 50, Math.ceil((extent * 4) / 10), '#444c56', '#2d333b']}
        position={[0, -0.3 - (singleModule ? 0 : box.floorThickness), 0]}
      />
      <OrbitControls makeDefault target={[0, (singleModule ? 20 : box.innerHeight) / 3, 0]} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.9} />
      </GizmoHelper>
    </Canvas>
  );
}
