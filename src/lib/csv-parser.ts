export interface CsvProperty {
  address: string;
  area?: number;
  plot_number?: string;
  egrid?: string;
  bfs_nr?: string;
  streetview_url?: string;
}

export function parseCsv(text: string): CsvProperty[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[;,\t]/).map(h => h.trim().toLowerCase());

  const findCol = (names: string[]) => {
    return headers.findIndex(h => names.some(n => h.includes(n)));
  };

  const addressIdx = findCol(['adresse', 'address', 'strasse']);
  const areaIdx = findCol(['fläche', 'flaeche', 'area', 'fläche m2', 'flaeche m2']);
  const plotIdx = findCol(['grundstück', 'grundstueck', 'plot', 'parzelle', 'nummer']);
  const egridIdx = findCol(['egrid', 'eidg']);
  const bfsIdx = findCol(['bfs', 'gemeinde']);
  const streetviewIdx = findCol(['streetview', 'street_view', 'google']);

  const separator = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = line.split(separator).map(c => c.trim());
    return {
      address: addressIdx >= 0 ? cols[addressIdx] || '' : cols[0] || '',
      area: areaIdx >= 0 ? parseFloat(cols[areaIdx]) || undefined : undefined,
      plot_number: plotIdx >= 0 ? cols[plotIdx] || undefined : undefined,
      egrid: egridIdx >= 0 ? cols[egridIdx] || undefined : undefined,
      bfs_nr: bfsIdx >= 0 ? cols[bfsIdx] || undefined : undefined,
      streetview_url: streetviewIdx >= 0 ? cols[streetviewIdx] || undefined : undefined,
    };
  }).filter(p => p.address);
}
