/**
 * Interaktive 3D-Vorschau (react-three-fiber).
 *
 * Die Geometrie liegt in Druckkoordinaten vor (Z oben). Die gesamte Szene wird
 * deshalb um -90° um X gedreht, damit sie in der Y-oben-Welt von Three.js
 * richtig steht.
 */
import { Edges, GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { usableHeight, type PlacedInstance } from '../geometry';
import { useStore } from '../state/store';
import type { PartPreview } from '../worker/protocol';

const PALETTE = ['#e08a3c', '#4f9dde', '#6cbf6a', '#c770c9', '#e0c23c', '#5ac7c0', '#e0605c', '#9a8cf0'];

function usePartGeometry(part: PartPreview | undefined) {
  return useMemo(() => {
    if (!part || part.triangles === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
    g.setIndex(new THREE.BufferAttribute(part.indices, 1));
    g.computeBoundingBox();
    return g;
  }, [part]);
}

function PartMesh({
  part,
  color,
  instance,
  selected,
  onSelect,
}: {
  part: PartPreview | undefined;
  color: string;
  instance: Pick<PlacedInstance, 'x' | 'y' | 'rotated' | 'depth' | 'width'>;
  selected: boolean;
  onSelect(): void;
}) {
  const geometry = usePartGeometry(part);
  if (!geometry) return null;
  // Rotation um Z: (x, y) → (−y, x); danach um die (Original-)Tiefe verschieben.
  const position: [number, number, number] = instance.rotated ? [instance.x + instance.width, instance.y, 0] : [instance.x, instance.y, 0];
  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={[0, 0, instance.rotated ? Math.PI / 2 : 0]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <meshStandardMaterial
        color={color}
        flatShading
        roughness={0.65}
        metalness={0.05}
        emissive={selected ? '#ffffff' : '#000000'}
        emissiveIntensity={selected ? 0.18 : 0}
      />
      <Edges threshold={20} color={selected ? '#ffffff' : '#1d1d1d'} />
    </mesh>
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
      {/* Karton (transparent) */}
      <mesh position={[W / 2, D / 2, (H - f) / 2]} renderOrder={10}>
        <boxGeometry args={[W + 2 * t, D + 2 * t, H + f]} />
        <meshStandardMaterial color="#b9a27c" transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
        <Edges color="#8a7350" />
      </mesh>
      {/* Innenraum */}
      <mesh position={[W / 2, D / 2, H / 2]}>
        <boxGeometry args={[W, D, H]} />
        <meshBasicMaterial visible={false} />
        <Edges color="#c9b48f" />
      </mesh>
      {/* Grenze nutzbare Höhe / Kopfraum */}
      {box.headroom > 0 && (
        <mesh position={[W / 2, D / 2, usable]} renderOrder={11}>
          <planeGeometry args={[W, D]} />
          <meshBasicMaterial color="#e05c5c" transparent opacity={0.08} depthWrite={false} side={THREE.DoubleSide} />
          <Edges color="#e05c5c" />
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
  const select = useStore((s) => s.select);
  const { box } = project;

  const colorOf = useMemo(() => {
    const map = new Map(project.modules.map((m, i) => [m.id, PALETTE[i % PALETTE.length]]));
    return (id: string) => map.get(id) ?? '#999';
  }, [project.modules]);

  const single = viewMode === 'single' ? project.modules.find((m) => m.id === selectedId) ?? project.modules[0] : undefined;
  const singlePart = single ? parts[single.id] : undefined;
  const singleBB = singlePart && singlePart.triangles > 0 ? bboxOf(singlePart.positions) : null;

  const extent = Math.max(box.innerWidth, box.innerDepth, box.innerHeight);
  const center: [number, number, number] = single && singleBB
    ? [-(singleBB[0] / 2), -(singleBB[1] / 2), 0]
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
          {single ? (
            <PartMesh
              part={singlePart}
              color={colorOf(single.id)}
              instance={{ x: 0, y: 0, rotated: false, width: 0, depth: 0 }}
              selected={false}
              onSelect={() => {}}
            />
          ) : (
            <>
              {layout.map((inst) => (
                <PartMesh
                  key={`${inst.moduleId}-${inst.copyIndex}`}
                  part={parts[inst.moduleId]}
                  color={colorOf(inst.moduleId)}
                  instance={inst}
                  selected={inst.moduleId === selectedId}
                  onSelect={() => select(inst.moduleId)}
                />
              ))}
              {showBox && <OuterBox />}
            </>
          )}
        </group>
      </group>

      <Grid
        position={[0, -0.01 - (single ? 0 : box.floorThickness), 0]}
        args={[2000, 2000]}
        cellSize={10}
        sectionSize={50}
        cellColor="#30363d"
        sectionColor="#444c56"
        fadeDistance={extent * 6}
        infiniteGrid
      />
      <OrbitControls makeDefault target={[0, (single ? (singleBB?.[2] ?? 0) : box.innerHeight) / 3, 0]} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.9} />
      </GizmoHelper>
    </Canvas>
  );
}

function bboxOf(p: Float32Array): [number, number, number] {
  let mx = 0, my = 0, mz = 0;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] > mx) mx = p[i];
    if (p[i + 1] > my) my = p[i + 1];
    if (p[i + 2] > mz) mz = p[i + 2];
  }
  return [mx, my, mz];
}
