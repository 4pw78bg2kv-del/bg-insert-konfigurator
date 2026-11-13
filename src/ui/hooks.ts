/**
 * Verbindet den Zustand mit Layout, Validierung und Geometrie-Worker.
 */
import { useEffect, useMemo, useRef } from 'react';
import { computeLayout, validateProject, type PlacedInstance, type ValidationMessage } from '../geometry';
import { useStore } from '../state/store';
import { geometryClient } from '../worker/client';

export function useLayout(): { layout: PlacedInstance[]; messages: ValidationMessage[] } {
  const project = useStore((s) => s.project);
  return useMemo(() => {
    const layout = computeLayout(project);
    return { layout, messages: validateProject(project, layout) };
  }, [project]);
}

/** Baut die Geometrie (entprellt) neu, sobald sich das Projekt ändert. */
export function useGeometryBuilder() {
  const project = useStore((s) => s.project);
  const setParts = useStore((s) => s.setParts);
  const setBuilding = useStore((s) => s.setBuilding);
  const latest = useRef(0);

  useEffect(() => {
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      setBuilding(true);
      geometryClient()
        .build(project)
        .then((res) => {
          if (ticket !== latest.current) return;
          setParts(res.parts);
          setBuilding(false);
        })
        .catch((err: Error) => {
          if (ticket !== latest.current) return;
          setBuilding(false, err.message);
        });
    }, 120);
    return () => clearTimeout(timer);
  }, [project, setParts, setBuilding]);
}
