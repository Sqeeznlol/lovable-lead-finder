import { afterEach, describe, expect, it, vi } from 'vitest';
import { herkunftAus, merkeHerkunft, sitzungsHerkunft } from '@/lib/werbe-herkunft';
import { seitenLink } from '@/lib/google-ads';

/**
 * Ein Lead aus einer Anzeige behält seine Herkunft, auch wenn die
 * Check-Seite ihren Link beim Wählen einer Adresse umschreibt (18. November:
 * gclid und utm_* gingen dabei verloren).
 */
describe('Herkunft eines Besuchs', () => {
  afterEach(() => sessionStorage.clear());

  it('liest Werbeangaben und Klick-Kennungen, sonst nichts', () => {
    expect(herkunftAus('?utm_source=google&utm_campaign=zone&gclid=Cj0abc&gbraid=x1&adresse=Weg%201&e=1')).toEqual({ utm_source: 'google', utm_campaign: 'zone', gclid: 'Cj0abc', gbraid: 'x1' });
  });

  it('übersteht das Umschreiben des Links', () => {
    merkeHerkunft('?utm_source=google&utm_medium=cpc&utm_campaign=zone&gclid=Cj0abc');
    // So sieht der Link nach dem Wählen einer Adresse aus (linkFuer).
    const danach = '?adresse=Dietlikerstrasse+52+8302+Kloten&e=2686756&n=1255508';
    merkeHerkunft(danach);
    expect(sitzungsHerkunft(danach)).toEqual({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'zone', gclid: 'Cj0abc' });
  });

  it('der erste Aufruf mit Werbeangaben gilt', () => {
    merkeHerkunft('?utm_source=google&gclid=erster');
    merkeHerkunft('?utm_source=bing&gclid=zweiter');
    expect(sitzungsHerkunft('').gclid).toBe('erster');
  });

  it('ohne Speicher (privates Fenster): was im Link steht', () => {
    const weg = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('voll'); });
    merkeHerkunft('?gclid=abc');
    expect(sitzungsHerkunft('?gclid=abc')).toEqual({ gclid: 'abc' });
    weg.mockRestore();
  });
});

describe('Der Google-Tag sieht den Klick', () => {
  it('reicht die Klick-Kennung nach, wenn der Link sie verloren hat', () => {
    expect(seitenLink('https://www.zonen-check.ch/?adresse=Weg+1&e=1&n=2', { gclid: 'Cj0abc', utm_source: 'google' }))
      .toBe('https://www.zonen-check.ch/?adresse=Weg+1&e=1&n=2&gclid=Cj0abc');
  });
  it('lässt den Link, wie er ist, wenn die Kennung drinsteht oder keine da ist', () => {
    expect(seitenLink('https://www.zonen-check.ch/?gclid=neu', { gclid: 'alt' })).toBeNull();
    expect(seitenLink('https://www.zonen-check.ch/', { utm_source: 'google' })).toBeNull();
  });
});
