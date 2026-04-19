import { useEffect, useState } from 'react';

export interface PlatformInfo {
  isIOS: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  isMobile: boolean;
  /** iPhone Safari in browser (not installed) — show "Add to home" hint */
  shouldPromptInstall: boolean;
}

function detect(): PlatformInfo {
  if (typeof window === 'undefined') {
    return { isIOS: false, isSafari: false, isStandalone: false, isMobile: false, shouldPromptInstall: false };
  }
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
  const isMobile = window.innerWidth < 768 || isIOS;
  return {
    isIOS,
    isSafari,
    isStandalone,
    isMobile,
    shouldPromptInstall: isIOS && isSafari && !isStandalone,
  };
}

export function usePlatform(): PlatformInfo {
  const [info, setInfo] = useState<PlatformInfo>(() => detect());

  useEffect(() => {
    const update = () => setInfo(detect());
    window.addEventListener('resize', update);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      mq.removeEventListener?.('change', update);
    };
  }, []);

  // Apply data attribute on <html> so CSS can react
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.ios = info.isIOS ? 'true' : 'false';
    html.dataset.standalone = info.isStandalone ? 'true' : 'false';
    if (info.isStandalone) html.classList.add('pwa-standalone');
    else html.classList.remove('pwa-standalone');
  }, [info.isIOS, info.isStandalone]);

  return info;
}
