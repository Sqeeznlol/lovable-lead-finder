/**
 * Master-Import: Robustes Spalten-Mapping für die Master-Liegenschafts-DB.
 *
 * Versteht die Spaltennamen aus den Katasterlinker-Excel-Exporten und
 * normalisiert sie auf die Felder der `properties`-Tabelle.
 *
 * Verwendet überall einen schlank-normalisierten Lookup, damit kleine
 * Abweichungen (Gross-/Kleinschreibung, Umlaute, Trennzeichen, m²) toleriert
 * werden.
 */

export interface MasterRow {
  // Identität
  egrid?: string | null;
  parzelle?: string | null;
  plot_number?: string | null;
  gwr_egid?: string | null;
  gvz_nr?: string | null;
  // Adresse
  address: string;
  strassenname?: string | null;
  hausnummer?: string | null;
  plz?: string | null;
  plz_ort?: string | null;
  gemeinde?: string | null;
  ortschaftsname?: string | null;
  bezirk?: string | null;
  bezirksort?: string | null;
  kanton?: string | null;
  // Geometrie / Gebäude
  area?: number | null;
  gebaeudeflaeche?: number | null;
  hnf_schaetzung?: number | null;
  wohnflaeche?: number | null;
  nutzflaeche?: number | null;
  baujahr?: number | null;
  renovationsjahr?: number | null;
  geschosse?: number | null;
  wohnungen?: number | null;
  ausnuetzung?: number | null;
  zone?: string | null;
  kategorie?: string | null;
  gebaeudeart?: string | null;
  geb_status?: string | null;
  // Sonstiges
  denkmalschutz?: string | null;
  denkmalschutz_titel?: string | null;
  isos?: string | null;
  isos_titel?: string | null;
  // Links
  google_maps_url?: string | null;
  streetview_url?: string | null;
  housing_stat_url?: string | null;
  gis_url?: string | null;
  objektadresse?: string | null;
  // Meta
  bfs_nr?: string | null;
  source_file?: string | null;
  // Rohwerte für Debugging / Auditing
  _raw?: Record<string, unknown>;
}

export interface ImportSummary {
  total: number;
  inserted: number;
  updated: number;
  duplicates: number;
  invalid: number;
  newGemeinden: number;
  errors: { row: number; reason: string }[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/m²|m2/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Map of normalized column name -> target field on MasterRow. */
const COLUMN_MAP: Record<string, keyof MasterRow> = {
  // Identität
  egrid: 'egrid',
  eidg: 'egrid',
  eidgnummer: 'egrid',
  eidgrid: 'egrid',
  egridnummer: 'egrid',
  parzelle: 'parzelle',
  parznr: 'parzelle',
  plotnumber: 'plot_number',
  grundstuck: 'plot_number',
  grundstucknr: 'plot_number',
  grundstucksnr: 'plot_number',
  grundstucknummer: 'plot_number',
  gwregid: 'gwr_egid',
  gwredid: 'gwr_egid',
  egid: 'gwr_egid',
  egidbfs: 'gwr_egid',
  gvznr: 'gvz_nr',
  // Adresse
  adresse: 'address',
  address: 'address',
  objektadresse: 'objektadresse',
  strassenname: 'strassenname',
  strasse: 'strassenname',
  hausnummer: 'hausnummer',
  plz: 'plz',
  plzort: 'plz_ort',
  gemeinde: 'gemeinde',
  ortschaftsname: 'ortschaftsname',
  ort: 'ortschaftsname',
  bezirk: 'bezirk',
  bezirksort: 'bezirksort',
  kanton: 'kanton',
  // Geometrie / Gebäude
  flache: 'area',
  area: 'area',
  grundstucksflache: 'area',
  gebaudeflache: 'gebaeudeflaeche',
  gebaudegrundflache: 'gebaeudeflaeche',
  hnf: 'hnf_schaetzung',
  hnfschatzung: 'hnf_schaetzung',
  hauptnutzflache: 'hnf_schaetzung',
  wohnflache: 'wohnflaeche',
  nutzflache: 'nutzflaeche',
  baujahr: 'baujahr',
  renovationsjahr: 'renovationsjahr',
  geschosse: 'geschosse',
  anzahlgeschosse: 'geschosse',
  wohnungen: 'wohnungen',
  anzahlwohnungen: 'wohnungen',
  ausnutzung: 'ausnuetzung',
  ausnutzungsziffer: 'ausnuetzung',
  zone: 'zone',
  typzone: 'zone',
  bauzone: 'zone',
  kategorie: 'kategorie',
  gebaudeart: 'gebaeudeart',
  gebstatus: 'geb_status',
  // Sonstiges
  denkmalschutz: 'denkmalschutz',
  denkmalschutztitel: 'denkmalschutz_titel',
  ortsbildnachisos: 'isos',
  isos: 'isos',
  isostitel: 'isos_titel',
  // Links
  googlemaps: 'google_maps_url',
  streetview: 'streetview_url',
  dealkatasteronline: 'housing_stat_url',
  // Meta
  bfs: 'bfs_nr',
  bfsnr: 'bfs_nr',
};

export interface ColumnMapping {
  sourceKey: string;
  targetField: keyof MasterRow;
}

export function detectMapping(headers: string[]): ColumnMapping[] {
  const out: ColumnMapping[] = [];
  const used = new Set<keyof MasterRow>();
  for (const h of headers) {
    const key = norm(String(h));
    const target = COLUMN_MAP[key];
    if (!target || used.has(target)) continue;
    used.add(target);
    out.push({ sourceKey: h, targetField: target });
  }
  return out;
}

const numericFields: ReadonlySet<keyof MasterRow> = new Set([
  'area', 'gebaeudeflaeche', 'hnf_schaetzung', 'wohnflaeche', 'nutzflaeche',
  'baujahr', 'renovationsjahr', 'geschosse', 'wohnungen', 'ausnuetzung',
]);

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).replace(/['’]/g, '').replace(/,/g, '.').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

const toStr = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' || s.toLowerCase() === 'nan' ? null : s;
};

/**
 * Convert one raw row into a MasterRow using the detected mapping.
 */
export function rowToMaster(
  row: Record<string, unknown>,
  mapping: ColumnMapping[],
  sourceFile: string,
): MasterRow {
  const out: MasterRow = { address: '' };
  for (const m of mapping) {
    const raw = row[m.sourceKey];
    if (numericFields.has(m.targetField)) {
      (out as unknown as Record<string, unknown>)[m.targetField] = toNumber(raw);
    } else {
      (out as unknown as Record<string, unknown>)[m.targetField] = toStr(raw);
    }
  }

  // Compose address if not present
  if (!out.address) {
    const composed = [out.objektadresse, [out.strassenname, out.hausnummer].filter(Boolean).join(' ')]
      .find(s => s && String(s).trim());
    if (composed) out.address = String(composed).trim();
  }

  // Derive plz from "PLZ/Ort" if needed
  if (!out.plz && out.plz_ort) {
    const m = String(out.plz_ort).match(/(\d{4})/);
    if (m) out.plz = m[1];
  }

  // Derive gemeinde from ortschaft / bezirksort fallback
  if (!out.gemeinde) {
    out.gemeinde = out.ortschaftsname || out.bezirksort || null;
  }

  // Default kanton ZH for our use case
  if (!out.kanton) out.kanton = 'ZH';

  // Generate links if missing
  if (!out.google_maps_url && out.address) {
    const q = encodeURIComponent(out.address + ' ' + (out.gemeinde || '') + ' Schweiz');
    out.google_maps_url = `https://www.google.ch/maps/place/${q}`;
  }
  if (!out.gis_url && (out.bfs_nr || out.parzelle) && out.parzelle) {
    out.gis_url = `https://maps.zh.ch/?locate=parz&locations=${out.bfs_nr || ''},${out.parzelle}&topic=DLGOWfarbigZH`;
  }

  out.source_file = sourceFile;
  return out;
}

export const isValidRow = (r: MasterRow): boolean => {
  return Boolean((r.egrid && r.egrid.length > 0) || (r.address && r.address.length > 0) || r.parzelle);
};

/** Convert MasterRow to the DB insert payload for `properties`. */
export function masterRowToDbInsert(r: MasterRow): Record<string, unknown> {
  return {
    address: r.address || `Parzelle ${r.parzelle || r.egrid || '?'}`,
    egrid: r.egrid || null,
    parzelle: r.parzelle || null,
    plot_number: r.plot_number || r.parzelle || null,
    gwr_egid: r.gwr_egid || null,
    gvz_nr: r.gvz_nr || null,
    strassenname: r.strassenname || null,
    hausnummer: r.hausnummer || null,
    plz: r.plz || null,
    plz_ort: r.plz_ort || null,
    gemeinde: r.gemeinde || null,
    ortschaftsname: r.ortschaftsname || null,
    bezirk: r.bezirk || null,
    bezirksort: r.bezirksort || null,
    kanton: r.kanton || 'ZH',
    area: r.area ?? null,
    gebaeudeflaeche: r.gebaeudeflaeche ?? null,
    hnf_schaetzung: r.hnf_schaetzung ?? null,
    wohnflaeche: r.wohnflaeche ?? null,
    nutzflaeche: r.nutzflaeche ?? null,
    baujahr: r.baujahr ?? null,
    renovationsjahr: r.renovationsjahr ?? null,
    geschosse: r.geschosse ?? null,
    wohnungen: r.wohnungen ?? null,
    ausnuetzung: r.ausnuetzung ?? null,
    zone: r.zone || null,
    kategorie: r.kategorie || null,
    gebaeudeart: r.gebaeudeart || null,
    geb_status: r.geb_status || 'Bestehend',
    denkmalschutz: r.denkmalschutz || null,
    denkmalschutz_titel: r.denkmalschutz_titel || null,
    isos: r.isos || null,
    isos_titel: r.isos_titel || null,
    google_maps_url: r.google_maps_url || null,
    streetview_url: r.streetview_url || null,
    housing_stat_url: r.housing_stat_url || null,
    gis_url: r.gis_url || null,
    objektadresse: r.objektadresse || null,
    bfs_nr: r.bfs_nr || null,
    source_file: r.source_file || null,
    status: 'Neu',
    preselection_status: 'Nicht geprüft',
    is_queried: false,
  };
}

/** Update payload only includes fields we want to refresh. */
export function masterRowToDbUpdate(r: MasterRow): Record<string, unknown> {
  // Only enrich missing data — never overwrite existing acquisition state.
  const u: Record<string, unknown> = {
    source_file: r.source_file || null,
  };
  // Add fields if present (these will be coalesced server-side via update)
  const fields: (keyof MasterRow)[] = [
    'gemeinde', 'plz', 'bezirk', 'kanton', 'strassenname', 'hausnummer',
    'area', 'gebaeudeflaeche', 'hnf_schaetzung', 'wohnflaeche', 'nutzflaeche',
    'baujahr', 'renovationsjahr', 'geschosse', 'wohnungen', 'ausnuetzung',
    'zone', 'kategorie', 'gebaeudeart', 'geb_status',
    'google_maps_url', 'streetview_url', 'gis_url', 'housing_stat_url',
  ];
  for (const f of fields) {
    const v = (r as unknown as Record<string, unknown>)[f];
    if (v !== null && v !== undefined && v !== '') u[f] = v;
  }
  return u;
}