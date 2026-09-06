import { z } from 'https://esm.sh/zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1';

// Wohin ein abgefragtes Objekt geht.
//
// Bis hierher legte dieser Ablauf Leads an -- die Eingangsliste von
// Pipedrive. Im Konto standen deshalb 0 Leads und 424 Deals: gearbeitet
// wird mit Deals, die Leads sah niemand an. Sie hinterliessen nur 55
// Labels, eines je Zone und Quartier, mit denen sich nichts mehr
// filtern liess.
//
// Jetzt entsteht ein Deal, und wo er landet, entscheidet die
// Telefonnummer: mit Nummer kann angerufen werden, ohne muss zuerst
// gesucht werden. Die Kennungen stammen aus dem Lauf "pipelines"
// (tools/pipedrive-pipelines.py) -- sie sind kontospezifisch und
// stehen deshalb hier und nicht in einer Vermutung.
const PIPELINE_AKQUISE = 20;
const STAGE_NEU = 82;
const PIPELINE_SEARCH = 24;
const STAGE_SUCHEN = 91;

// Pipedrive custom field keys (shared between Deals & Leads)
const FIELD_ZONE = '6283f1bd5f9e2220c96dfebf3904e789c9850773';
const FIELD_BAUJAHR = 'd8e495e217d7f56099b33cf339612f0bb58bb2b7';
const FIELD_HNF = '7773ad912df15700b104f5057012a28cbc6b220a';
const FIELD_GRUNDSTUECK = 'caf47d7ebeb687f75a0d0e4a069073846f0a37b9';
const FIELD_GESCHOSSE = 'df02438b21bc6d823e3abf7dc7d4a71f2239724e';
const FIELD_EGRID = 'd210ce9334d6812187af1be8b71b7c97f6afd8db';
const FIELD_EGID = '0c81850c8b58b9d88b9ff57b919824bc8f7b6c91';
const FIELD_GEMEINDE = 'e9bd061887c619b93d0ad759dfbef11e55e4c58a';
const FIELD_OEREB = '6579ea588f2ed43f6f76b239e3a5d2fe7e65be59';
const FIELD_OWNER_1 = 'e57bb30238d4f5aa2feeb1c102dfd51c5688928c';
const FIELD_OWNER_2 = 'ea0de3fe875f87c3e9bde1eb7416030016d18125';
const FIELD_OWNER_3 = 'd312bedebdad79dfcdeacc7f3912ff3bfd8306a7';
const FIELD_OWNER_4 = '00586e2f3149ab8f3d6cebb55b7ec626630cb9d0';
const FIELD_OWNER_5 = '0c4c530966d09ae4874184dc0c4eef6f4532ff90';
const FIELD_GOOGLE_PIPE = '8318ae128ecd86600b20dc02b3a72537f4c9fd8a';
const FIELD_PARZELLE = '101c2348b81c4a6ea14b716fb3ce029becce0acd';
const FIELD_DENKMALSCHUTZ = '61c1072a5b0e13a65eda73367f3575e559d5d3c9';
const FIELD_ISOS = 'a08848e0744572436ab47ed520e8b1b980e6a19f';

const PropertySchema = z.object({
  id: z.string(),
  address: z.string(),
  plz_ort: z.string().nullish(),
  gemeinde: z.string().nullish(),
  zone: z.string().nullish(),
  baujahr: z.number().nullish(),
  gebaeudeflaeche: z.number().nullish(),
  area: z.number().nullish(),
  geschosse: z.number().nullish(),
  egrid: z.string().nullish(),
  gwr_egid: z.string().nullish(),
  parzelle: z.string().nullish(),
  bfs_nr: z.string().nullish(),
  owner_name: z.string().nullish(),
  owner_address: z.string().nullish(),
  owner_phone: z.string().nullish(),
  owner_name_2: z.string().nullish(),
  owner_address_2: z.string().nullish(),
  owner_phone_2: z.string().nullish(),
  owners_json: z.array(z.object({
    fullName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    street: z.string().optional(),
    streetNumber: z.string().optional(),
    plz: z.string().optional(),
    ort: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    ownershipType: z.string().optional(),
    type: z.string().optional(),
  })).nullish(),
  notes: z.string().nullish(),
  status: z.string(),
  google_maps_url: z.string().nullish(),
  kanton: z.string().nullish(),
  kategorie: z.string().nullish(),
  wohnungen: z.number().nullish(),
  denkmalschutz: z.string().nullish(),
  isos: z.string().nullish(),
});

const BodySchema = z.object({
  properties: z.array(PropertySchema).min(1).max(50),
});

// --- Pipedrive API helpers ---

async function pipedriveGet(path: string, token: string, params?: Record<string, string>) {
  const url = new URL(`${PIPEDRIVE_BASE}${path}`);
  url.searchParams.set('api_token', token);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

async function pipedrivePost(path: string, token: string, body: unknown) {
  const res = await fetch(`${PIPEDRIVE_BASE}${path}?api_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Die Zonen-Labels sind mit den Leads weggefallen: 55 Stück, eines je
// Zone und Quartier, mit denen sich nichts mehr filtern liess. Die Zone
// steht als eigenes Feld am Deal.

// --- Name Parsing ---

function parseOwnerForPipedrive(rawName: string | null | undefined): { firstName: string; lastName: string } {
  if (!rawName || !rawName.trim()) return { firstName: '', lastName: '' };
  const trimmed = rawName.trim();
  const parts = trimmed.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    const lastName = parts[0];
    const firstNameParts = parts[1].split(/\s+/);
    const firstName = firstNameParts[0] || '';
    return { firstName, lastName };
  }
  return { firstName: '', lastName: trimmed };
}

// --- Clean phone number and format to Swiss +41 ---

function cleanPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  let num = phone.replace(/[^\d+]/g, '');
  if (!num) return '';
  if (num.startsWith('0041')) {
    num = '+41' + num.slice(4);
  } else if (num.startsWith('41') && !num.startsWith('+')) {
    num = '+' + num;
  } else if (num.startsWith('0')) {
    num = '+41' + num.slice(1);
  } else if (!num.startsWith('+')) {
    num = '+41' + num;
  }
  return num;
}

// --- Check if a phone string is a real number (not just text like "keine Nummer") ---

function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[^\d]/g, '');
  return cleaned.length >= 7;
}

// --- Duplicate Check ---

async function findExistingOrg(token: string, address: string): Promise<number | null> {
  const res = await pipedriveGet('/organizations/search', token, {
    term: address, fields: 'name', exact_match: 'false',
  });
  const items = res?.data?.items || [];
  for (const item of items) {
    if (item?.item?.name?.includes(address)) return item.item.id;
  }
  return null;
}

async function findExistingPerson(token: string, name: string): Promise<number | null> {
  const res = await pipedriveGet('/persons/search', token, {
    term: name, fields: 'name', exact_match: 'false',
  });
  const items = res?.data?.items || [];
  for (const item of items) {
    if (item?.item?.name === name) return item.item.id;
  }
  return null;
}

// --- Create or update a person in Pipedrive ---

async function upsertPerson(
  token: string,
  ownerName: string,
  ownerPhone: string | null | undefined,
  orgId: number | undefined,
  structuredOwner?: { firstName?: string; lastName?: string; street?: string; streetNumber?: string; plz?: string; ort?: string } | null,
): Promise<number | undefined> {
  // Prefer structured data from owners_json
  let firstName = structuredOwner?.firstName || '';
  let lastName = structuredOwner?.lastName || '';

  // Fallback to parsing raw name
  if (!firstName && !lastName) {
    const parsed = parseOwnerForPipedrive(ownerName);
    firstName = parsed.firstName;
    lastName = parsed.lastName;
  }

  const displayName = firstName ? `${firstName} ${lastName}` : lastName;
  const cleanPhone = cleanPhoneNumber(ownerPhone);

  // Build structured address from parsed fields
  const streetFull = [structuredOwner?.street, structuredOwner?.streetNumber].filter(Boolean).join(' ');
  const plzOrt = [structuredOwner?.plz, structuredOwner?.ort].filter(Boolean).join(' ');

  const existingPerson = await findExistingPerson(token, displayName);
  if (existingPerson) {
    const updatePayload: Record<string, unknown> = {};
    if (cleanPhone) updatePayload.phone = [{ value: cleanPhone, primary: true }];
    if (Object.keys(updatePayload).length > 0) {
      await fetch(`${PIPEDRIVE_BASE}/persons/${existingPerson}?api_token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
    }
    return existingPerson;
  }

  const personData: Record<string, unknown> = {
    name: displayName,
    first_name: firstName,
    last_name: lastName,
  };
  if (orgId) personData.org_id = orgId;
  if (cleanPhone) personData.phone = [{ value: cleanPhone, primary: true }];

  // Add structured address to Pipedrive person
  if (streetFull || plzOrt) {
    personData.postal_address = streetFull;
    personData.postal_address_zip_code = structuredOwner?.plz || '';
    personData.postal_address_locality = structuredOwner?.ort || '';
    personData.postal_address_street_number = structuredOwner?.streetNumber || '';
  }

  const personRes = await pipedrivePost('/persons', token, personData);
  return personRes?.data?.id;
}

/**
 * Alle Eigentümer wörtlich, so wie das Portal sie ausgibt.
 *
 * In der Pipeline "Search" wird von Hand nachgesucht. Dafür nützt eine
 * aufbereitete Zeile wenig -- gebraucht wird der Wortlaut: Schreibweise
 * des Namens, Adresse, Art des Eigentums. Danach wird gesucht, und ein
 * geglätteter Name führt in die Irre.
 */
function buildEigentuemerRoh(prop: z.infer<typeof PropertySchema>): string {
  const owners = Array.isArray(prop.owners_json) ? prop.owners_json : [];
  if (owners.length === 0) return '';
  const zeilen = owners.map((o, i) => {
    const teile = [
      o.fullName || [o.firstName, o.lastName].filter(Boolean).join(' '),
      o.address || [o.street, o.streetNumber, o.plz, o.ort].filter(Boolean).join(' '),
      o.ownershipType || o.type || '',
      o.phone || '',
    ].filter(Boolean);
    return `${i + 1}. ${teile.join(' | ')}`;
  });
  return `<br/><b>Eigentümer wörtlich aus dem Portal:</b><br/><pre>${
    zeilen.join('\n')}</pre>`;
}

// --- Build rich notes HTML ---

function buildNotiz(prop: z.infer<typeof PropertySchema>): string {
  const lines: string[] = [];

  // Address & maps
  const fullAddress = prop.address + (prop.plz_ort ? ', ' + prop.plz_ort : '');
  lines.push(`<b>Adresse:</b> ${fullAddress}`);
  
  const mapsQuery = encodeURIComponent(fullAddress);
  const mapsUrl = prop.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  lines.push(`<b>Google Maps:</b> <a href="${mapsUrl}">Karte öffnen</a>`);

  // ÖREB Kataster link
  if (prop.parzelle && prop.bfs_nr) {
    const oerebUrl = `https://maps.zh.ch/?locate=parz&locations=${prop.bfs_nr},${prop.parzelle}&topic=OerebKatasterZH`;
    lines.push(`<b>ÖREB Kataster:</b> <a href="${oerebUrl}">Kataster öffnen</a>`);
  }


  // Property details
  const details: string[] = [];
  if (prop.zone) details.push(`Zone: ${prop.zone}`);
  if (prop.baujahr) details.push(`Baujahr: ${prop.baujahr}`);
  if (prop.gebaeudeflaeche) details.push(`HNF: ${Math.round(prop.gebaeudeflaeche)}m²`);
  if (prop.area) details.push(`Grundstück: ${Math.round(prop.area)}m²`);
  if (prop.geschosse) details.push(`Geschosse: ${prop.geschosse}`);
  if (prop.kategorie) details.push(`Kategorie: ${prop.kategorie}`);
  if (prop.wohnungen) details.push(`Wohnungen: ${prop.wohnungen}`);
  if (prop.egrid) details.push(`EGRID: ${prop.egrid}`);
  if (prop.gwr_egid) details.push(`EGID: ${prop.gwr_egid}`);
  if (details.length > 0) {
    lines.push(`<br/><b>Liegenschaft:</b><br/>${details.join('<br/>')}`);
  }

  // Owner 1
  if (prop.owner_name) {
    lines.push(`<br/><b>Eigentümer 1:</b> ${prop.owner_name}`);
    if (prop.owner_address) lines.push(`Adresse: ${prop.owner_address}`);
    if (prop.owner_phone && isValidPhone(prop.owner_phone)) {
      lines.push(`Telefon: ${prop.owner_phone}`);
    } else if (prop.owner_phone) {
      lines.push(`Telefon: ${prop.owner_phone} (nicht verifiziert)`);
    }
    // Search links for owner 1
    const parsed1 = parseOwnerForPipedrive(prop.owner_name);
    const name1 = parsed1.firstName ? `${parsed1.firstName} ${parsed1.lastName}` : parsed1.lastName;
    const telSearchUrl1 = `https://tel.search.ch/?was=${encodeURIComponent(name1)}`;
    const opendiUrl1 = `https://www.opendi.ch/q?q=${encodeURIComponent(name1)}`;
    lines.push(`<a href="${telSearchUrl1}">tel.search.ch</a> | <a href="${opendiUrl1}">Opendi</a>`);
  }

  // Owner 2
  if (prop.owner_name_2) {
    lines.push(`<br/><b>Eigentümer 2:</b> ${prop.owner_name_2}`);
    if (prop.owner_address_2) lines.push(`Adresse: ${prop.owner_address_2}`);
    if (prop.owner_phone_2 && isValidPhone(prop.owner_phone_2)) {
      lines.push(`Telefon: ${prop.owner_phone_2}`);
    } else if (prop.owner_phone_2) {
      lines.push(`Telefon: ${prop.owner_phone_2} (nicht verifiziert)`);
    }
    const parsed2 = parseOwnerForPipedrive(prop.owner_name_2);
    const name2 = parsed2.firstName ? `${parsed2.firstName} ${parsed2.lastName}` : parsed2.lastName;
    const telSearchUrl2 = `https://tel.search.ch/?was=${encodeURIComponent(name2)}`;
    const opendiUrl2 = `https://www.opendi.ch/q?q=${encodeURIComponent(name2)}`;
    lines.push(`<a href="${telSearchUrl2}">tel.search.ch</a> | <a href="${opendiUrl2}">Opendi</a>`);
  }

  // Additional owners (3+) from owners_json
  const owners = Array.isArray(prop.owners_json) ? prop.owners_json : [];
  for (let i = 2; i < owners.length; i++) {
    const o = owners[i];
    const oName = o.fullName || [o.firstName, o.lastName].filter(Boolean).join(' ');
    if (!oName) continue;
    lines.push(`<br/><b>Eigentümer ${i + 1}:</b> ${oName}`);
    const oAddr = o.address || [o.street, o.streetNumber, o.plz, o.ort].filter(Boolean).join(' ');
    if (oAddr) lines.push(`Adresse: ${oAddr}`);
    if (o.phone && isValidPhone(o.phone)) lines.push(`Telefon: ${o.phone}`);
    const telUrl = `https://tel.search.ch/?was=${encodeURIComponent(oName)}`;
    lines.push(`<a href="${telUrl}">tel.search.ch</a>`);
  }

  // User notes
  if (prop.notes) lines.push(`<br/><b>Notizen:</b> ${prop.notes}`);

  const roh = buildEigentuemerRoh(prop);
  if (roh) lines.push(roh);

  return lines.join('<br/>');
}

/**
 * Der Kataster des richtigen Kantons.
 *
 * Bis hierher trug jeder Deal einen Zürcher Link -- auch die
 * Thurgauer. Der zeigte dort irgendeine Zürcher Parzelle gleicher
 * Nummer: schlimmer als kein Link, weil er beim Telefonieren
 * glaubwürdig aussieht.
 */
function katasterLink(prop: z.infer<typeof PropertySchema>): string | null {
  const kanton = String(prop.kanton ?? '').trim().toUpperCase();
  if (kanton === 'TG') {
    // Der Thurgau sucht über den EGRID, nicht über die Parzellennummer.
    if (!prop.egrid) return null;
    return 'https://map.geo.tg.ch/apps/mf-geoadmin3/?lang=de&topic=oereb'
      + '&bgLayer=basemap_farbig&zoom=8'
      + `&swisssearch=${encodeURIComponent(prop.egrid)}`;
  }
  if (prop.parzelle && prop.bfs_nr) {
    return `https://maps.zh.ch/?locate=parz&locations=${prop.bfs_nr},${prop.parzelle}&topic=OerebKatasterZH`;
  }
  return null;
}

// --- Main Handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const PIPEDRIVE_API_TOKEN = Deno.env.get('PIPEDRIVE_API_TOKEN');
    if (!PIPEDRIVE_API_TOKEN) {
      return new Response(JSON.stringify({ error: 'PIPEDRIVE_API_TOKEN not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const exportedAddresses = new Set<string>();
    const results: { propertyId: string; dealId?: number; personId?: number; person2Id?: number; orgId?: number; skipped?: boolean; error?: string }[] = [];

    for (const prop of parsed.data.properties) {
      try {
        if (exportedAddresses.has(prop.address)) {
          results.push({ propertyId: prop.id, skipped: true });
          continue;
        }

        // Parzellennummer, Adresse, Postleitzahl mit Ort:
        //
        //     Parz. 2688 · Lettenmattstrasse 12, 8903 Birmensdorf
        //
        // Die Parzelle steht vorn, weil sie das Grundstück eindeutig
        // benennt und in Grundbuch wie ÖREB-Kataster der Schlüssel ist.
        // Dann die Adresse -- damit beginnt das Gespräch am Telefon --
        // und die Postleitzahl, die sie über mehrere Kantone eindeutig
        // macht.
        //
        // Zone und Gebäudefläche standen früher hier. Sie beantworten
        // die Frage "welches Grundstück ist das" nicht, und die Fläche
        // ändert sich mit jeder Neuberechnung.
        const ortsteil = [prop.plz, prop.gemeinde || prop.plz_ort]
          .filter(Boolean).join(' ');
        const parzelle = String(prop.parzelle || prop.plot_number || '').trim();
        const hinten = [prop.address, ortsteil].filter(Boolean).join(', ');
        const dealTitel = parzelle && prop.address
          ? `Parz. ${parzelle} · ${hinten}`
          : parzelle
            ? [`Parz. ${parzelle}`, ortsteil].filter(Boolean).join(', ')
            : hinten || prop.address;

        // 1. Gibt es den Deal schon?
        //
        // Geprüft wurde bisher, ob eine Organisation mit dieser Adresse
        // existiert -- und wenn ja, brach der Lauf ab. Das war falsch:
        // eine Organisation entsteht bei jedem Export, ein Deal nicht.
        // Wer heute den Eigentümer abfragte, bekam deshalb keinen Deal,
        // weil die Adresse vor einem Jahr schon einmal exportiert
        // worden war. Geprüft wird jetzt über die EGRID -- sie benennt
        // das Grundstück, nicht die Schreibweise seiner Adresse.
        if (prop.egrid) {
          const vorhanden = await pipedriveGet('/deals/search', PIPEDRIVE_API_TOKEN, {
            term: prop.egrid, exact_match: 'true',
          });
          const treffer = (vorhanden?.data?.items || []).length > 0;
          if (treffer) {
            results.push({ propertyId: prop.id, skipped: true });
            exportedAddresses.add(prop.address);
            continue;
          }
        }

        // 2. Die Organisation wiederverwenden, wenn es sie schon gibt.
        const existingOrgId = await findExistingOrg(PIPEDRIVE_API_TOKEN, prop.address);
        const orgRes = existingOrgId
          ? { data: { id: existingOrgId } }
          : await pipedrivePost('/organizations', PIPEDRIVE_API_TOKEN, {
              name: `Liegenschaft: ${prop.address}`,
              address: prop.address + (prop.plz_ort ? ', ' + prop.plz_ort : ''),
            });
        const orgId = orgRes?.data?.id;

        // Extract structured owners from owners_json
        const owners = Array.isArray(prop.owners_json) ? prop.owners_json : [];
        const owner1Struct = owners.length > 0 ? owners[0] : null;
        const owner2Struct = owners.length > 1 ? owners[1] : null;

        // 3. Create/update Person 1 ONLY if they have a valid phone number
        let personId: number | undefined;
        if (prop.owner_name && isValidPhone(prop.owner_phone)) {
          personId = await upsertPerson(PIPEDRIVE_API_TOKEN, prop.owner_name, prop.owner_phone, orgId, owner1Struct);
        }

        // 4. Create/update Person 2 ONLY if they have a valid phone number
        let person2Id: number | undefined;
        if (prop.owner_name_2 && isValidPhone(prop.owner_phone_2)) {
          person2Id = await upsertPerson(PIPEDRIVE_API_TOKEN, prop.owner_name_2, prop.owner_phone_2, orgId, owner2Struct);
        }

        // 5. Deal anlegen -- in Akquise, wenn angerufen werden kann,
        //    sonst in Search, wo der Eigentümer von Hand gesucht wird.
        const hatNummer = isValidPhone(prop.owner_phone)
          || isValidPhone(prop.owner_phone_2)
          || owners.some(o => isValidPhone(o.phone));
        const dealData: Record<string, unknown> = {
          title: dealTitel,
          org_id: orgId,
          pipeline_id: hatNummer ? PIPELINE_AKQUISE : PIPELINE_SEARCH,
          stage_id: hatNummer ? STAGE_NEU : STAGE_SUCHEN,
        };
        if (personId) dealData.person_id = personId;

        // Custom fields
        if (prop.zone) dealData[FIELD_ZONE] = prop.zone;
        if (prop.baujahr) dealData[FIELD_BAUJAHR] = prop.baujahr;
        if (prop.gebaeudeflaeche) dealData[FIELD_HNF] = Math.round(prop.gebaeudeflaeche);
        if (prop.area) dealData[FIELD_GRUNDSTUECK] = Math.round(prop.area);
        if (prop.geschosse) dealData[FIELD_GESCHOSSE] = prop.geschosse;
        if (prop.egrid) dealData[FIELD_EGRID] = prop.egrid;
        if (prop.gwr_egid) dealData[FIELD_EGID] = prop.gwr_egid;
        if (prop.gemeinde) dealData[FIELD_GEMEINDE] = prop.gemeinde;
        const kataster = katasterLink(prop);
        if (kataster) dealData[FIELD_OEREB] = kataster;

        if (prop.parzelle) dealData[FIELD_PARZELLE] = prop.parzelle;
        if (prop.denkmalschutz) dealData[FIELD_DENKMALSCHUTZ] = prop.denkmalschutz;
        if (prop.isos) dealData[FIELD_ISOS] = prop.isos;

        // Google Maps link for Pipedrive
        const fullAddr = prop.address + (prop.plz_ort ? ', ' + prop.plz_ort : '');
        dealData[FIELD_GOOGLE_PIPE] = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}`;

        // Owner custom fields (1-5), rest goes into notes
        const ownerFields = [FIELD_OWNER_1, FIELD_OWNER_2, FIELD_OWNER_3, FIELD_OWNER_4, FIELD_OWNER_5];
        const ownerDisplays: string[] = [];
        if (prop.owner_name) ownerDisplays.push(prop.owner_name);
        if (prop.owner_name_2) ownerDisplays.push(prop.owner_name_2);
        for (let oi = 2; oi < owners.length; oi++) {
          const o = owners[oi];
          const oName = o.fullName || [o.firstName, o.lastName].filter(Boolean).join(' ');
          if (oName) ownerDisplays.push(oName);
        }
        for (let oi = 0; oi < Math.min(ownerDisplays.length, 5); oi++) {
          dealData[ownerFields[oi]] = ownerDisplays[oi];
        }

        console.log('Deal anlegen:', JSON.stringify({
          title: dealTitel, pipeline_id: dealData.pipeline_id,
          stage_id: dealData.stage_id, person_id: personId,
        }));
        const dealRes = await pipedrivePost('/deals', PIPEDRIVE_API_TOKEN, dealData);
        const dealId = dealRes?.data?.id;

        if (!dealId) {
          console.error('Deal creation failed:', JSON.stringify(dealRes));
          results.push({ propertyId: prop.id, error: `Deal creation failed: ${JSON.stringify(dealRes)}` });
          continue;
        }

        // 6. Add rich note with all details, links, owner info
        const noteContent = buildNotiz(prop);
        await pipedrivePost('/notes', PIPEDRIVE_API_TOKEN, {
          deal_id: dealId,
          content: noteContent,
        });

        exportedAddresses.add(prop.address);
        results.push({ propertyId: prop.id, dealId, personId, person2Id, orgId: orgId || undefined });
      } catch (err) {
        results.push({ propertyId: prop.id, error: String(err) });
      }
    }

    const successCount = results.filter(r => !r.error && !r.skipped).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const errorCount = results.filter(r => r.error).length;

    return new Response(JSON.stringify({
      success: true,
      results,
      summary: { created: successCount, skipped: skippedCount, errors: errorCount },
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
