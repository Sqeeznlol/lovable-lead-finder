import { createContext, useContext, useState, ReactNode } from 'react';

export type CantonId = 'ZH' | 'ZG' | 'AG' | 'LU';

export interface Canton {
  id: CantonId;
  name: string;
  active: boolean;
}

export const CANTONS: Canton[] = [
  { id: 'ZH', name: 'Zürich', active: true },
  { id: 'ZG', name: 'Zug', active: false },
  { id: 'AG', name: 'Aargau', active: false },
  { id: 'LU', name: 'Luzern', active: false },
];

interface CantonCtx {
  current: CantonId;
  setCurrent: (id: CantonId) => void;
  cantons: Canton[];
}

const Ctx = createContext<CantonCtx | null>(null);
const KEY = 'bauraum-canton';

export function CantonProvider({ children }: { children: ReactNode }) {
  const [current, setCurrentState] = useState<CantonId>(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(KEY)) as CantonId | null;
    return saved && CANTONS.find(c => c.id === saved && c.active) ? saved : 'ZH';
  });
  const setCurrent = (id: CantonId) => {
    const c = CANTONS.find(x => x.id === id);
    if (!c?.active) return;
    setCurrentState(id);
    localStorage.setItem(KEY, id);
  };
  return <Ctx.Provider value={{ current, setCurrent, cantons: CANTONS }}>{children}</Ctx.Provider>;
}

export function useCanton() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCanton must be used within CantonProvider');
  return c;
}
