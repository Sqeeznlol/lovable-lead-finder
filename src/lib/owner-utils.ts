/**
 * Smart owner name parsing and classification utilities.
 * 
 * Handles formats like:
 * - "Multari, Giuseppe, Wydenweg 24, 8408 Winterthur, Schweiz, Alleineigentum"
 * - "Multari, Giuseppe Peter, Wydenweg 24, ..."  (Peter = middle name, strip for search)
 * - "Immobilien AG, Zürich" → classified as AG
 * - "Stadt Zürich, ..." → classified as Stadt
 */

export type OwnerType = 'person' | 'ag' | 'stadt' | 'other_org';

const AG_PATTERNS = [
  /\bAG\b/i, /\bGmbH\b/i, /\bSA\b/i, /\bS\.A\.\b/i, /\bSàrl\b/i,
  /\bGenossenschaft\b/i, /\bStiftung\b/i, /\bVerein\b/i, /\bInc\b/i,
  /\bCorp\b/i, /\bLtd\b/i, /\bHolding\b/i, /\bImmobilien\b/i,
  /\bVerwaltung\b/i, /\bAnlagestiftung\b/i, /\bPensionskasse\b/i,
  /\bVorsorge\b/i, /\bFonds\b/i, /\bTrust\b/i,
];

const STADT_PATTERNS = [
  /^Stadt\s/i, /^Gemeinde\s/i, /^Kanton\s/i, /^Bezirk\s/i,
  /^Politische Gemeinde/i, /^Kirchgemeinde/i, /^Schulgemeinde/i,
  /^Bund\b/i, /^Eidgenossenschaft/i,
];

export function classifyOwner(name: string): OwnerType {
  if (!name) return 'person';
  const trimmed = name.trim();

  for (const p of STADT_PATTERNS) {
    if (p.test(trimmed)) return 'stadt';
  }
  for (const p of AG_PATTERNS) {
    if (p.test(trimmed)) return 'ag';
  }
  return 'person';
}

export function ownerTypeLabel(type: OwnerType): string {
  switch (type) {
    case 'ag': return 'Firma/AG';
    case 'stadt': return 'Öffentlich';
    case 'other_org': return 'Organisation';
    default: return 'Privatperson';
  }
}

export function ownerTypeColor(type: OwnerType): string {
  switch (type) {
    case 'ag': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'stadt': return 'bg-red-100 text-red-700 border-red-200';
    case 'other_org': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    default: return 'bg-green-100 text-green-700 border-green-200';
  }
}

export interface ParsedOwner {
  fullName: string;        // "Multari, Giuseppe"
  searchName: string;      // "Giuseppe Multari" (for tel.search)
  firstName: string;       // "Giuseppe"
  lastName: string;        // "Multari"
  address: string;         // "Wydenweg 24, 8408 Winterthur"
  ownershipType: string;   // "Alleineigentum"
  type: OwnerType;
}

/**
 * Parse raw owner string from GIS:
 * "Multari, Giuseppe Peter, Wydenweg 24, 8408 Winterthur, Schweiz, Alleineigentum"
 */
export function parseOwnerString(raw: string): ParsedOwner {
  if (!raw || !raw.trim()) {
    return { fullName: '', searchName: '', firstName: '', lastName: '', address: '', ownershipType: '', type: 'person' };
  }

  const trimmed = raw.trim();
  const type = classifyOwner(trimmed);

  // For organizations, don't try to parse as person
  if (type !== 'person') {
    return {
      fullName: trimmed,
      searchName: trimmed,
      firstName: '',
      lastName: trimmed,
      address: '',
      ownershipType: '',
      type,
    };
  }

  // Split by comma
  const parts = trimmed.split(',').map(s => s.trim());

  // Ownership patterns to detect
  const ownershipPatterns = ['Alleineigentum', 'Miteigentum', 'Gesamteigentum', 'Stockwerkeigentum'];
  const ownershipIdx = parts.findIndex(p => ownershipPatterns.some(op => p.toLowerCase().includes(op.toLowerCase())));
  const ownershipType = ownershipIdx >= 0 ? parts[ownershipIdx] : '';

  // Country to strip
  const countryIdx = parts.findIndex(p => /^(Schweiz|Suisse|Svizzera|Switzerland|CH)$/i.test(p));

  // lastName = first part
  const lastName = parts[0] || '';

  // firstName = second part, but strip middle names (keep only first word)
  let firstName = '';
  if (parts.length > 1) {
    const nameParts = parts[1].trim().split(/\s+/);
    firstName = nameParts[0] || ''; // Only first name, strip middle names
  }

  const fullName = firstName ? `${lastName}, ${firstName}` : lastName;
  const searchName = firstName ? `${firstName} ${lastName}` : lastName;

  // Address: everything between name parts and ownership/country
  const addressParts = parts.slice(2).filter((_, i) => {
    const actualIdx = i + 2;
    return actualIdx !== ownershipIdx && actualIdx !== countryIdx;
  });
  const address = addressParts.join(', ');

  return { fullName, searchName, firstName, lastName, address, ownershipType, type };
}

/**
 * Parse a raw text that may contain multiple owners separated by newlines or semicolons
 */
export function parseMultipleOwners(raw: string): ParsedOwner[] {
  if (!raw) return [];
  // Split by newline or semicolon
  const lines = raw.split(/[\n;]/).map(s => s.trim()).filter(Boolean);
  return lines.map(parseOwnerString);
}

/**
 * Generate tel.search.ch URL with smart name handling
 */
export function telSearchUrl(name: string, ort?: string): string {
  const parsed = parseOwnerString(name);
  const searchName = parsed.searchName || name;
  // For tel.search, use "firstName lastName" format with location
  const q = [searchName, ort].filter(Boolean).join(' ');
  return `https://tel.search.ch/?was=${encodeURIComponent(q)}`;
}

/**
 * Generate tel.search.ch URL from parsed owner with their own address
 */
export function telSearchUrlParsed(parsed: ParsedOwner, fallbackOrt?: string): string {
  const location = parsed.address || fallbackOrt || '';
  const q = [parsed.searchName, location].filter(Boolean).join(' ');
  return `https://tel.search.ch/?was=${encodeURIComponent(q)}`;
}

/**
 * Generate opendi.ch URL
 */
export function opendiUrl(name: string): string {
  const parsed = parseOwnerString(name);
  return `https://www.opendi.ch/q?q=${encodeURIComponent(parsed.searchName || name)}`;
}

/**
 * Generate opendi URL from parsed owner
 */
export function opendiUrlParsed(parsed: ParsedOwner): string {
  return `https://www.opendi.ch/q?q=${encodeURIComponent(parsed.searchName)}`;
}
