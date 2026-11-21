import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Der Messpunkt von Google Ads meldet nur den Lead, nur nach Zustimmung
 * und nur mit gültiger Conversion-ID und Label (Werbeplan, November 2026).
 */
const skripte = () => [...document.querySelectorAll('script')].map(s => s.src).filter(s => s.includes('googletagmanager'));

async function frisch(idWert: string, labelWert: string, wahl: 'alle' | 'noetig' | null) {
  vi.resetModules();
  vi.stubEnv('VITE_GOOGLE_ADS_ID', idWert);
  vi.stubEnv('VITE_GOOGLE_ADS_LABEL', labelWert);
  document.head.innerHTML = '';
  delete (window as unknown as { dataLayer?: unknown }).dataLayer;
  delete (window as unknown as { gtag?: unknown }).gtag;
  const { setzeZustimmung } = await import('@/lib/zustimmung');
  setzeZustimmung(wahl);
  return import('@/lib/google-ads');
}

describe('Google Ads: Lead melden', () => {
  afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); });

  // Seit dem 21. November steht das Konto fest (KONTO); leer heisst jetzt «das Konto».
  // Ohne gültiges Konto, etwa nach einem Tippfehler bei Vercel, lädt weiterhin nichts.
  it('ohne gültiges Konto lädt nichts', async () => {
    const g = await frisch('kein-konto', 'x', 'alle');
    g.googleLead();
    expect(skripte()).toEqual([]);
  });

  it('ohne Zustimmung lädt nichts', async () => {
    const g = await frisch('AW-1234567890', 'AbC-dEf_123', 'noetig');
    g.googleLead();
    expect(skripte()).toEqual([]);
  });

  it('eine falsch eingetragene ID lädt keine fremde Adresse', async () => {
    const g = await frisch('https://boese.example/x.js', 'AbC-dEf_123', 'alle');
    expect(g.ADS_ID).toBeUndefined();
    g.googleLead();
    expect(skripte()).toEqual([]);
  });

  it('lädt gleich nach «Einverstanden», nicht erst beim Lead', async () => {
    const g = await frisch('AW-1234567890', 'AbC-dEf_123', null);
    g.googleBeobachten();
    expect(skripte()).toEqual([]);
    const { setzeZustimmung } = await import('@/lib/zustimmung');
    setzeZustimmung('alle');
    expect(skripte()).toEqual(['https://www.googletagmanager.com/gtag/js?id=AW-1234567890']);
    const eintraege = ((window as unknown as { dataLayer: IArguments[] }).dataLayer).map(a => [...a]);
    // Messung ja, persönliche Werbung nein.
    expect(eintraege[0]).toEqual(['consent', 'default', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied', analytics_storage: 'denied' }]);
    // Wer später «Nur nötige» wählt, nimmt die Messung zurück.
    setzeZustimmung('noetig');
    const zuletzt = ((window as unknown as { dataLayer: IArguments[] }).dataLayer).map(a => [...a]).at(-1);
    expect(zuletzt).toEqual(['consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied' }]);
  });

  it('mit Konto und Zustimmung: einmal laden, Lead als Conversion melden', async () => {
    const g = await frisch('AW-1234567890', 'AbC-dEf_123', 'alle');
    g.googleLead();
    g.googleLead();
    expect(skripte()).toEqual(['https://www.googletagmanager.com/gtag/js?id=AW-1234567890']);
    const eintraege = ((window as unknown as { dataLayer: IArguments[] }).dataLayer).map(a => [...a]);
    expect(eintraege[2]).toEqual(['config', 'AW-1234567890', {}]);
    expect(eintraege.filter(e => e[0] === 'event')).toEqual([
      ['event', 'conversion', { send_to: 'AW-1234567890/AbC-dEf_123' }],
      ['event', 'conversion', { send_to: 'AW-1234567890/AbC-dEf_123' }],
    ]);
  });
});

describe('Konto «Bauraum» (21. November)', () => {
  it('ID und Label der Conversion «Lead» stehen fest und haben die Form, die Google verlangt', async () => {
    const { KONTO } = await import('@/lib/google-ads');
    expect(KONTO).toEqual({ id: 'AW-18588031014', label: 'Y3eECO-s4rwdEKawu59F' });
    expect(KONTO.id).toMatch(/^AW-\d{6,14}$/);
    expect(KONTO.label).toMatch(/^[A-Za-z0-9_-]{6,40}$/);
  });
});
