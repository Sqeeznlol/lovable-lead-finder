import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'bluelight' | 'system';

interface ThemeCtx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  resolved: 'light' | 'dark' | 'bluelight';
}

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = 'bauraum-theme';

function applyTheme(resolved: 'light' | 'dark' | 'bluelight') {
  const root = document.documentElement;
  root.classList.remove('dark', 'bluelight');
  if (resolved === 'dark') root.classList.add('dark');
  if (resolved === 'bluelight') root.classList.add('bluelight');
}

function resolve(mode: ThemeMode): 'light' | 'dark' | 'bluelight' {
  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(KEY)) as ThemeMode | null;
    return saved ?? 'light';
  });
  const [resolved, setResolved] = useState<'light' | 'dark' | 'bluelight'>(() => resolve(mode));

  useEffect(() => {
    const r = resolve(mode);
    setResolved(r);
    applyTheme(r);
    localStorage.setItem(KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const r = resolve('system');
      setResolved(r);
      applyTheme(r);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  return <Ctx.Provider value={{ mode, setMode: setModeState, resolved }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used within ThemeProvider');
  return c;
}
