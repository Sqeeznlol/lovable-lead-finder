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
