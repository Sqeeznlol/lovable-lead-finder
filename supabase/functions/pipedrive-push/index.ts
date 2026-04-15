import { z } from 'https://esm.sh/zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1';

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
  kategorie: z.string().nullish(),
  wohnungen: z.number().nullish(),
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

// --- Lead Label Cache ---

const labelCache = new Map<string, string>();

async function getOrCreateLeadLabel(token: string, zone: string): Promise<string | undefined> {
  if (!zone) return undefined;
  if (labelCache.has(zone)) return labelCache.get(zone);

  const res = await pipedriveGet('/leadLabels', token);
  const labels = res?.data || [];
  for (const label of labels) {
    if (label.name === zone) {
      labelCache.set(zone, label.id);
      return label.id;
    }
  }

  const createRes = await pipedrivePost('/leadLabels', token, {
    name: zone,
    color: 'blue',
  });
  const newId = createRes?.data?.id;
  if (newId) {
    labelCache.set(zone, newId);
    return newId;
  }
  return undefined;
}

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

// --- Build rich notes HTML ---

function buildLeadNotes(prop: z.infer<typeof PropertySchema>): string {
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

  // User notes
  if (prop.notes) lines.push(`<br/><b>Notizen:</b> ${prop.notes}`);

  return lines.join('<br/>');
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
    const results: { propertyId: string; leadId?: string; personId?: number; person2Id?: number; orgId?: number; skipped?: boolean; error?: string }[] = [];

    for (const prop of parsed.data.properties) {
      try {
        if (exportedAddresses.has(prop.address)) {
          results.push({ propertyId: prop.id, skipped: true });
          continue;
        }

        // Title: "W5 · 450m² · Zürich"
        const titleParts = [
          prop.zone || '',
          prop.gebaeudeflaeche ? `${Math.round(prop.gebaeudeflaeche)}m²` : '',
          prop.gemeinde || prop.plz_ort || '',
        ].filter(Boolean);
        const leadTitle = titleParts.join(' · ') || prop.address;

        // 1. Duplicate check via org
        const existingOrgId = await findExistingOrg(PIPEDRIVE_API_TOKEN, prop.address);
        if (existingOrgId) {
          results.push({ propertyId: prop.id, orgId: existingOrgId, skipped: true });
          exportedAddresses.add(prop.address);
          continue;
        }

        // 2. Create Organization
        const orgRes = await pipedrivePost('/organizations', PIPEDRIVE_API_TOKEN, {
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

        // 5. Create Lead with custom fields + zone label
        const labelId = await getOrCreateLeadLabel(PIPEDRIVE_API_TOKEN, prop.zone || '');
        const leadData: Record<string, unknown> = {
          title: leadTitle,
          organization_id: orgId,
        };
        if (personId) leadData.person_id = personId;
        if (labelId) leadData.label_ids = [labelId];

        // Custom fields
        if (prop.zone) leadData[FIELD_ZONE] = prop.zone;
        if (prop.baujahr) leadData[FIELD_BAUJAHR] = prop.baujahr;
        if (prop.gebaeudeflaeche) leadData[FIELD_HNF] = Math.round(prop.gebaeudeflaeche);
        if (prop.area) leadData[FIELD_GRUNDSTUECK] = Math.round(prop.area);
        if (prop.geschosse) leadData[FIELD_GESCHOSSE] = prop.geschosse;
        if (prop.egrid) leadData[FIELD_EGRID] = prop.egrid;
        if (prop.gwr_egid) leadData[FIELD_EGID] = prop.gwr_egid;
        if (prop.gemeinde) leadData[FIELD_GEMEINDE] = prop.gemeinde;
        // ÖREB Kataster link
        if (prop.parzelle && prop.bfs_nr) {
          leadData[FIELD_OEREB] = `https://maps.zh.ch/?locate=parz&locations=${prop.bfs_nr},${prop.parzelle}&topic=OerebKatasterZH`;
        }

        console.log('Creating lead:', JSON.stringify({ title: leadTitle, person_id: personId, organization_id: orgId }));
        const leadRes = await pipedrivePost('/leads', PIPEDRIVE_API_TOKEN, leadData);
        const leadId = leadRes?.data?.id;

        if (!leadId) {
          console.error('Lead creation failed:', JSON.stringify(leadRes));
          results.push({ propertyId: prop.id, error: `Lead creation failed: ${JSON.stringify(leadRes)}` });
          continue;
        }

        // 6. Add rich note with all details, links, owner info
        const noteContent = buildLeadNotes(prop);
        await pipedrivePost('/notes', PIPEDRIVE_API_TOKEN, {
          lead_id: leadId,
          content: noteContent,
        });

        exportedAddresses.add(prop.address);
        results.push({ propertyId: prop.id, leadId, personId, person2Id, orgId: orgId || undefined });
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
