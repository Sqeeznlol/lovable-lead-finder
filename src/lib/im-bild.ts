import { useEffect, useState } from 'react';

/**
 * Ob gerade eines der Elemente zum Selektor im Bild ist. Die Aufrufleiste
 * auf dem Handy richtet sich danach: Sie zeigt sich nur, wenn kein anderer
 * Aufruf zu sehen ist, damit nie zwei Knöpfe dasselbe verlangen.
 * Beginnt mit "im Bild", damit die Leiste beim Laden nicht aufblitzt.
 */
export function useImBild(selektor: string, abhaengig: unknown[] = []): boolean {
  const [imBild, setImBild] = useState(true);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const ziele = [...document.querySelectorAll(selektor)];
    if (!ziele.length) { setImBild(false); return; }
    const stand = new Map<Element, boolean>();
    const b = new IntersectionObserver(eintraege => {
      for (const e of eintraege) stand.set(e.target, e.isIntersecting);
      setImBild([...stand.values()].some(Boolean));
    });
    ziele.forEach(z => b.observe(z));
    return () => b.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selektor, ...abhaengig]);
  return imBild;
}
