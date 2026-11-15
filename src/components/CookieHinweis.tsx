import { useEffect, useState } from 'react';
import { EREIGNIS, setzeZustimmung, zustimmung } from '@/lib/zustimmung';

/**
 * Cookie-Hinweis der Check-Seiten: ein Satz, zwei gleichwertige Knöpfe.
 * "Nur nötige" ist so gross wie "Einverstanden" -- eine versteckte Ablehnung
 * wäre unlauter. Ohne Wahl bleibt die Seite voll nutzbar.
 */
export function CookieHinweis({ datenschutz }: { datenschutz?: () => void }) {
  const [offen, setOffen] = useState(() => zustimmung() === null);
  useEffect(() => {
    const neu = () => setOffen(zustimmung() === null);
    window.addEventListener(EREIGNIS, neu);
    return () => window.removeEventListener(EREIGNIS, neu);
  }, []);
  if (!offen) return null;
  return (
    <div className="cookie" role="region" aria-label="Cookies">
      <p>
        Cookies für Werbung setzen wir nur mit Ihrer Zustimmung. Die Besucherzählung ist anonym und kommt ohne Cookies aus.
        {datenschutz && <> <button type="button" className="verweis" onClick={datenschutz}>Datenschutz</button></>}
      </p>
      <div className="knoepfe">
        <button type="button" className="knopf" onClick={() => setzeZustimmung('noetig')}>Nur nötige</button>
        <button type="button" className="knopf marke" onClick={() => setzeZustimmung('alle')}>Einverstanden</button>
      </div>
    </div>
  );
}
