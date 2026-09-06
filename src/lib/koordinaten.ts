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
