/**
 * Von Längen- und Breitengrad in Schweizer Landeskoordinaten.
 *
 * Die Kantonsportale rechnen in LV95: E um 2'600'000, N um 1'200'000.
 * Google und swisstopo sprechen dagegen WGS84. Wer das eine ins andere
 * überführen will, braucht entweder einen Dienst -- oder die Näherung,
 * die swisstopo selbst veröffentlicht und die auf etwa einen Meter
 * genau ist. Für eine Karte, die eine Parzelle zeigen soll, genügt das
 * bei Weitem.
 *
 * Quelle: swisstopo, "Näherungslösungen für die Transformation zwischen
 * den Schweizer Landeskoordinaten und WGS84".
 */
export interface Landeskoordinaten {
  e: number;
  n: number;
}

export function wgs84NachLv95(lat: number, lon: number): Landeskoordinaten {
  // Beide Winkel zuerst in Sekunden, dann auf den Nullpunkt Bern
  // bezogen und auf 10'000 gestaucht -- so verlangt es die Formel.
  const b = (lat * 3600 - 169028.66) / 10000;
  const l = (lon * 3600 - 26782.5) / 10000;

  const y =
    2600072.37 +
    211455.93 * l -
    10938.51 * l * b -
    0.36 * l * b * b -
    44.54 * l * l * l;

  const x =
    1200147.07 +
    308807.95 * b +
    3745.25 * l * l +
    76.63 * b * b -
    194.56 * l * l * b +
    119.79 * b * b * b;

  return { e: Math.round(y * 100) / 100, n: Math.round(x * 100) / 100 };
}

/**
 * Zurück: Landeskoordinaten in Längen- und Breitengrad, gleiche Quelle
 * und Genauigkeit. Die Punkte der Liegenschaften liegen in LV95 vor
 * (parzelle_punkt), die Kacheln der Karte erwarten WGS84.
 */
export function lv95NachWgs84(e: number, n: number): { lat: number; lon: number } {
  const y = (e - 2600000) / 1e6;
  const x = (n - 1200000) / 1e6;
  const l = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  const b = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x * x * x;
  return { lat: (b * 100) / 36, lon: (l * 100) / 36 };
}
