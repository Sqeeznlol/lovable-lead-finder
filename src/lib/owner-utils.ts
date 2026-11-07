/**
 * Smart owner name parsing and classification utilities.
 * 
 * Handles formats like:
 * - "Multari, Giuseppe, Wydenweg 24, 8408 Winterthur, Schweiz, Alleineigentum"
 * - "Multari, Giuseppe Peter, Wydenweg 24, ..."  (Peter = middle name, strip for search)
 * - "Immobilien AG, Zürich" → classified as AG
 * - "Stadt Zürich, ..." → classified as Stadt
 * - Portal group headers: "Vollenweider/Vollenweider, einfache Gesellschaft, Gesamteigentum"
 * - Portal individual: "Vollenweider, Moritz Andreas, Holzrai 5, 8602 Wangen b. Dübendorf, Schweiz"
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
  street: string;          // "Holzrai"
  streetNumber: string;    // "5"
  plz: string;             // "8602"
  ort: string;             // "Wangen b. Dübendorf"
  ownershipType: string;   // "Alleineigentum"
  type: OwnerType;
}

const EMPTY_PARSED: ParsedOwner = {
  fullName: '', searchName: '', firstName: '', lastName: '',
  address: '', street: '', streetNumber: '', plz: '', ort: '',
  ownershipType: '', type: 'person',
};

/**
 * Detect if a line is a portal group header like:
 * "Vollenweider/Vollenweider, einfache Gesellschaft, Gesamteigentum"
 * These contain "/" in the first segment and ownership keywords but no street address.
 */
export function isGroupHeader(line: string): boolean {
  if (!line) return false;
  const lower = line.toLowerCase();
  // Group headers often have: "Name/Name, einfache Gesellschaft, Gesamteigentum"
  if (line.includes('/') && (
    lower.includes('einfache gesellschaft') ||
    lower.includes('gesamteigentum') ||
    lower.includes('miteigentum') ||
    lower.includes('stockwerkeigentum')
  )) return true;
  // Also detect standalone ownership type lines
  if (/^(Gesamt|Mit|Allein|Stockwerk)eigentum$/i.test(line.trim())) return true;
  return false;
}

/**
 * Extract ownership type from a group header line
 */
function extractOwnershipFromHeader(header: string): string {
  const lower = header.toLowerCase();
  if (lower.includes('gesamteigentum')) return 'Gesamteigentum';
  if (lower.includes('miteigentum')) return 'Miteigentum';
  if (lower.includes('stockwerkeigentum')) return 'Stockwerkeigentum';
  if (lower.includes('alleineigentum')) return 'Alleineigentum';
  return '';
}

/**
 * Parse raw owner string from GIS portal:
 * "Vollenweider, Moritz Andreas, Holzrai 5, 8602 Wangen b. Dübendorf, Schweiz"
 * "A. Bommer Immobilien AG, mit Sitz in Zürich, Aktiengesellschaft, Schweighofstrasse 409, 8055 Zürich, Schweiz, Alleineigentum"
 */
export function parseOwnerString(raw: string, groupOwnershipType?: string): ParsedOwner {
  if (!raw || !raw.trim()) {
    return { ...EMPTY_PARSED };
  }

  const trimmed = raw.trim();
  const type = classifyOwner(trimmed);

  // Split by comma
  const parts = trimmed.split(',').map(s => s.trim());

  // Ownership patterns
  const ownershipPatterns = ['Alleineigentum', 'Miteigentum', 'Gesamteigentum', 'Stockwerkeigentum'];
  const ownershipIdx = parts.findIndex(p => ownershipPatterns.some(op => p.toLowerCase().includes(op.toLowerCase())));
  const ownershipType = ownershipIdx >= 0 ? parts[ownershipIdx] : (groupOwnershipType || '');

  // Country to strip
  const countryIdx = parts.findIndex(p => /^(Schweiz|Suisse|Svizzera|Switzerland|CH)$/i.test(p));

  // Skip phrases for AG/org owners
  const skipPhrases = ['mit sitz in', 'aktiengesellschaft', 'gesellschaft mit', 'genossenschaft', 'einfache gesellschaft'];

  // For organizations: take first part as name, find address in remaining
  if (type !== 'person') {
    let name = parts[0] || '';
    let street = '';
    let streetNumber = '';
    let plz = '';
    let ort = '';

    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      const pLower = p.toLowerCase();

      if (i === ownershipIdx || i === countryIdx) continue;
      if (skipPhrases.some(s => pLower.startsWith(s) || pLower === s)) continue;

      // PLZ + Ort pattern: "8055 Zürich" or "8602 Wangen b. Dübendorf"
      const plzMatch = p.match(/^(\d{4})\s+(.+)$/);
      if (plzMatch) {
        plz = plzMatch[1];
        ort = plzMatch[2];
        continue;
      }

      // Street + number pattern: "Schweighofstrasse 409"
      const streetMatch = p.match(/^(.+?)\s+(\d+\w*)$/);
      if (streetMatch && !street) {
        street = streetMatch[1];
        streetNumber = streetMatch[2];
        continue;
      }
    }

    const addressStr = [
      street && streetNumber ? `${street} ${streetNumber}` : street,
      plz && ort ? `${plz} ${ort}` : ''
    ].filter(Boolean).join(', ');

    return {
      fullName: name,
      searchName: name,
      firstName: '',
      lastName: name,
      address: addressStr,
      street,
      streetNumber,
      plz,
      ort,
      ownershipType,
      type,
    };
  }

  // Person parsing: "Nachname, Vorname(n), Strasse Nr, PLZ Ort, Land, Eigentum"
  const lastName = parts[0] || '';

  // firstName = second part (may have multiple names like "Moritz Andreas")
  let firstName = '';
  let firstNameFull = '';
  if (parts.length > 1 && !parts[1].match(/\d/)) {
    firstNameFull = parts[1].trim();
    const nameParts = firstNameFull.split(/\s+/);
    firstName = nameParts[0] || ''; // First name only for search
  }

  const fullName = firstNameFull ? `${lastName}, ${firstNameFull}` : lastName;
  const searchName = firstName ? `${firstName} ${lastName}` : lastName;

  // Find street + PLZ/Ort in remaining parts
  let street = '';
  let streetNumber = '';
  let plz = '';
  let ort = '';

  const startIdx = firstNameFull ? 2 : 1;
  for (let i = startIdx; i < parts.length; i++) {
    const p = parts[i];
    if (i === ownershipIdx || i === countryIdx) continue;

    // PLZ + Ort: "8602 Wangen b. Dübendorf"
    const plzMatch = p.match(/^(\d{4})\s+(.+)$/);
    if (plzMatch) {
      plz = plzMatch[1];
      ort = plzMatch[2];
      continue;
    }

    // Street + number: "Holzrai 5" or "Hegnaustrasse 51"
    const streetMatch = p.match(/^(.+?)\s+(\d+\w*)$/);
    if (streetMatch && !street) {
      street = streetMatch[1];
      streetNumber = streetMatch[2];
      continue;
    }
  }

  const addressStr = [
    street && streetNumber ? `${street} ${streetNumber}` : street,
    plz && ort ? `${plz} ${ort}` : ''
  ].filter(Boolean).join(', ');

  return { fullName, searchName, firstName, lastName, address: addressStr, street, streetNumber, plz, ort, ownershipType, type };
}

/**
 * Parse portal text that may contain a group header + multiple owners.
 * 
 * Input format from portal:
 * ```
 * Vollenweider/Vollenweider, einfache Gesellschaft, Gesamteigentum
 * (blank line)
 * Vollenweider, Moritz Andreas, Holzrai 5, 8602 Wangen b. Dübendorf, Schweiz
 * (blank line)
 * Vollenweider, Matthias Ulrich, Hegnaustrasse 51, 8602 Wangen b. Dübendorf, Schweiz
 * ```
 */
export function parsePortalOwnerText(raw: string): ParsedOwner[] {
  if (!raw) return [];

  // Split by blank lines or double newlines to get blocks
  const blocks = raw.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);

  // If no blank-line separation, try single newlines
  const lines = blocks.length <= 1
    ? raw.split(/\n/).map(s => s.trim()).filter(Boolean)
    : blocks;

  let groupOwnership = '';
  const owners: ParsedOwner[] = [];

  for (const line of lines) {
    // Check if this is a group header
    if (isGroupHeader(line)) {
      groupOwnership = extractOwnershipFromHeader(line);
      continue;
    }

    // Skip very short lines
    if (line.length < 5) continue;

    const parsed = parseOwnerString(line, groupOwnership);
    if (parsed.fullName) {
      owners.push(parsed);
    }
  }

  return owners;
}

/**
 * Parse a raw text that may contain multiple owners separated by newlines or semicolons
 */
export function parseMultipleOwners(raw: string): ParsedOwner[] {
  if (!raw) return [];
  // Use the smart portal parser
  return parsePortalOwnerText(raw);
}

/**
 * Generate search.ch/tel URL: "Nachname, Vorname  Strasse"
 */
export function telSearchUrl(name: string, ort?: string): string {
  const parsed = parseOwnerString(name);
  return telSearchUrlParsed(parsed, ort);
}

/**
 * Generate search.ch/tel URL from parsed owner
 * Format: "Nachname, Vorname  Strassenname" (without PLZ/Ort)
 */
export function telSearchUrlParsed(parsed: ParsedOwner, fallbackOrt?: string): string {
  // Use structured street if available, otherwise extract from address
  const street = parsed.street || (parsed.address || '').split(',')[0]?.trim() || '';

  let q: string;
  if (parsed.lastName && parsed.firstName) {
    q = `${parsed.lastName}, ${parsed.firstName}  ${street}`.trim();
  } else {
    q = [parsed.searchName || parsed.fullName, street].filter(Boolean).join('  ');
  }

  return `https://search.ch/tel/?all=${encodeURIComponent(q)}`;
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