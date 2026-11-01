/**
 * Ein lesbarer Name für das Gerät, aus dem User-Agent.
 *
 * Den Namen, den das Gerät selbst trägt ("Julians iPhone"), verrät kein
 * Browser -- aus gutem Grund. Was er verrät: Betriebssystem und Browser.
 * Das reicht, um in der Liste der Anmeldungen "iPhone · Safari" von
 * "Windows · Chrome" zu unterscheiden; mehr gibt es nicht, und mehr
 * steht deshalb auch nicht da.
 *
 * Ein iPad meldet sich seit iPadOS 13 als Mac. Unterscheiden lässt es
 * sich nur am Touch -- darum der zweite Parameter.
 */
export function geraetName(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  touch: boolean = typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 1,
): string {
  const system =
    /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && touch) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /CrOS/.test(ua) ? 'Chromebook'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unbekannt';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /SamsungBrowser/.test(ua) ? 'Samsung'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox'
    : /Chrome\/|CriOS\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  return `${system} · ${browser}`;
}

/**
 * Das Gerät so genau, wie der Browser es hergibt: System mit Version,
 * Browser mit Version, beim Android das Modell, und die Bildschirmgrösse.
 *
 * Gemessen am 1. November: festgehalten wurde nur "iPhone · Safari" und
 * "Windows · Chrome" -- zwei iPhones waren nicht auseinanderzuhalten.
 * Die Bildschirmgrösse trennt die iPhone-Reihen (390×844 ist ein 12 bis
 * 14, 430×932 ein Pro Max); den Namen "Julians iPhone" gibt trotzdem
 * kein Browser her. Dafür gibt es die Gerätekennung unten, die der
 * Admin einmal benennt.
 */
export function geraetGenau(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  touch: boolean = typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 1,
  hinweise: { model?: string; platformVersion?: string } = {},
  bild: { w: number; h: number } | null = typeof screen !== 'undefined' ? { w: screen.width, h: screen.height } : null,
): string {
  const [system, browser] = geraetName(ua, touch).split(' · ');
  const ios = ua.match(/(?:iPhone|CPU) OS (\d+)_(\d+)/);
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  const mac = ua.match(/Mac OS X (\d+)[._](\d+)/);
  let sys = system;
  if ((system === 'iPhone' || system === 'iPad') && ios) sys += ` · iOS ${ios[1]}.${ios[2]}`;
  else if (system === 'Android' && android) sys += ` ${android[1]}`;
  else if (system === 'Windows') {
    // Windows 11 meldet sich im User-Agent als 10; nur die Hinweise des
    // Browsers (Chrome, Edge) sagen es: platformVersion ab 13 ist 11.
    const v = Number((hinweise.platformVersion ?? '').split('.')[0]);
    sys += v >= 13 ? ' 11' : v > 0 ? ' 10' : '';
  } else if (system === 'Mac' && mac && mac[1] !== '10') sys += ` ${mac[1]}`;
  // Safari trägt seine Version unter "Version/", die anderen unter ihrem Namen.
  const bv = (browser === 'Safari' ? ua.match(/Version\/(\d+)/)
    : ua.match(/(?:Edg|OPR|SamsungBrowser|Firefox|FxiOS|Chrome|CriOS)\/(\d+)/))?.[1];
  const teile = [sys, bv ? `${browser} ${bv}` : browser];
  if (hinweise.model) teile.splice(1, 0, hinweise.model);
  if (bild && bild.w > 0) teile.push(`${Math.min(bild.w, bild.h)}×${Math.max(bild.w, bild.h)}`);
  return teile.join(' · ');
}

/** Die Hinweise, die Chrome und Edge auf Nachfrage geben (Modell, Systemversion). Safari gibt keine. */
export async function geraetHinweise(): Promise<{ model?: string; platformVersion?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uad = (navigator as any).userAgentData;
    if (!uad?.getHighEntropyValues) return {};
    const h = await uad.getHighEntropyValues(['model', 'platformVersion']);
    return { model: h.model || undefined, platformVersion: h.platformVersion || undefined };
  } catch { return {}; }
}

/**
 * Eine Kennung für diesen Browser auf diesem Gerät, einmal erzeugt und
 * im Gerät gemerkt. Sie enthält nichts über das Gerät; sie dient nur
 * dazu, dass der Admin ein Gerät einmal benennt ("Julians iPhone") und
 * es bei jeder weiteren Anmeldung wiedererkennt.
 */
export function geraetKennung(): string | null {
  try {
    const k = 'aurora-geraet';
    let id = localStorage.getItem(k);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).slice(0, 36);
      localStorage.setItem(k, id);
    }
    return id;
  } catch { return null; }
}
