import { z } from 'https://esm.sh/zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1';

// Pipedrive custom field keys (from deal/lead fields)
const FIELD_ZONE = '6283f1bd5f9e2220c96dfebf3904e789c9850773';
const FIELD_BAUJAHR = 'd8e495e217d7f56099b33cf339612f0bb58bb2b7';
const FIELD_HNF = '7773ad912df15700b104f5057012a28cbc6b220a';
const FIELD_GRUNDSTUECK = 'caf47d7ebeb687f75a0d0e4a069073846f0a37b9';
const FIELD_GESCHOSSE = 'df02438b21bc6d823e3abf7dc7d4a71f2239724e';
const FIELD_EGRID = 'd210ce9334d6812187af1be8b71b7c97f6afd8db';
const FIELD_EGID = '0c81850c8b58b9d88b9ff57b919824bc8f7b6c91';
const FIELD_GEMEINDE = 'e9bd061887c619b93d0ad759dfbef11e55e4c58a';
const FIELD_ADRESSE = '3f9bb1e671f9d3a2a264d056d827844ea33670db';
const FIELD_MAPS = '58fa258249a145c3264c66e66c3f6e2d78837cfe';

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
  owner_name: z.string().nullish(),
  owner_address: z.string().nullish(),
  owner_phone: z.string().nullish(),
  owner_name_2: z.string().nullish(),
  owner_address_2: z.string().nullish(),
  owner_phone_2: z.string().nullish(),
  notes: z.string().nullish(),
  status: z.string(),
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

// --- Label Management ---

const ZONE_COLORS = ['blue', 'green', 'purple', 'orange', 'red', 'yellow', 'brown', 'pink', 'dark-gray', 'gray'];

async function ensureZoneLabel(token: string, zone: string, labelCache: Map<string, string>): Promise<string | undefined> {
  if (!zone) return undefined;

  // Check cache first
  if (labelCache.has(zone)) return labelCache.get(zone);

  // Fetch all labels
  if (labelCache.size === 0) {
    const res = await pipedriveGet('/leadLabels', token);
    const labels: { id: string; name: string }[] = res?.data || [];
    for (const l of labels) {
      labelCache.set(l.name, l.id);
    }
    if (labelCache.has(zone)) return labelCache.get(zone);
  }

  // Create new label with a color
  const colorIndex = labelCache.size % ZONE_COLORS.length;
  const created = await pipedrivePost('/leadLabels', token, {
    name: zone,
    color: ZONE_COLORS[colorIndex],
  });
  if (created?.data?.id) {
    labelCache.set(zone, created.data.id);
    return created.data.id;
  }
  return undefined;
}

// --- Name Parsing ---

function parseOwnerForPipedrive(rawName: string | null | undefined): { firstName: string; lastName: string } {
  if (!rawName || !rawName.trim()) return { firstName: '', lastName: '' };

  const trimmed = rawName.trim();
  const parts = trimmed.split(',').map(s => s.trim());

  if (parts.length >= 2) {
    // Format: "Nachname, Vorname ..." -> take first word of second part as firstName
    const lastName = parts[0];
    const firstNameParts = parts[1].split(/\s+/);
    const firstName = firstNameParts[0] || '';
    return { firstName, lastName };
  }

  // Single name or org
  return { firstName: '', lastName: trimmed };
}

function extractStreetFromAddress(rawName: string | null | undefined): string {
  if (!rawName || !rawName.trim()) return '';
  const parts = rawName.trim().split(',').map(s => s.trim());
  // Address parts start after lastName, firstName — typically index 2+
  // Filter out ownership types and country
  const ownershipPatterns = ['alleineigentum', 'miteigentum', 'gesamteigentum', 'stockwerkeigentum'];
  const countryPatterns = ['schweiz', 'suisse', 'svizzera', 'switzerland', 'ch'];
  
  const addressParts = parts.slice(2).filter(p => {
    const lower = p.toLowerCase();
    return !ownershipPatterns.some(op => lower.includes(op)) && !countryPatterns.includes(lower);
  });
  return addressParts.join(', ');
}

// --- Clean phone number (only digits and +) ---

function cleanPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

// --- Duplicate Check ---

async function findExistingOrg(token: string, address: string): Promise<number | null> {
  const res = await pipedriveGet('/organizations/search', token, {
    term: address,
    fields: 'name',
    exact_match: 'false',
  });
  const items = res?.data?.items || [];
  for (const item of items) {
    if (item?.item?.name?.includes(address)) {
      return item.item.id;
    }
  }
  return null;
}

async function findExistingPerson(token: string, name: string): Promise<number | null> {
  const res = await pipedriveGet('/persons/search', token, {
    term: name,
    fields: 'name',
    exact_match: 'false',
  });
  const items = res?.data?.items || [];
  for (const item of items) {
    if (item?.item?.name === name) {
      return item.item.id;
    }
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

    // Label cache (zone -> label_id)
    const labelCache = new Map<string, string>();

    const results: { propertyId: string; leadId?: string; personId?: number; orgId?: number; skipped?: boolean; error?: string }[] = [];

    for (const prop of parsed.data.properties) {
      try {
        // Title: "W5 · 320m² · Winterthur" format
        const titleParts = [
          prop.zone || '',
          prop.gebaeudeflaeche ? `${Math.round(prop.gebaeudeflaeche)}m²` : '',
          prop.gemeinde || prop.plz_ort || '',
        ].filter(Boolean);
        const leadTitle = titleParts.join(' · ') || prop.address;

        // 1. Find or create Organization
        let orgId = await findExistingOrg(PIPEDRIVE_API_TOKEN, prop.address);
        if (!orgId) {
          const orgRes = await pipedrivePost('/organizations', PIPEDRIVE_API_TOKEN, {
            name: `Liegenschaft: ${prop.address}`,
            address: prop.address + (prop.plz_ort ? ', ' + prop.plz_ort : ''),
          });
          orgId = orgRes?.data?.id;
        }

        // 2. Find or create Person (owner 1) with proper name splitting
        let personId: number | undefined;
        if (prop.owner_name) {
          const { firstName, lastName } = parseOwnerForPipedrive(prop.owner_name);
          const displayName = firstName ? `${firstName} ${lastName}` : lastName;
          const cleanPhone = cleanPhoneNumber(prop.owner_phone);
          const ownerStreet = extractStreetFromAddress(prop.owner_name);
          const personAddress = prop.owner_address || ownerStreet;

          const existingPerson = await findExistingPerson(PIPEDRIVE_API_TOKEN, displayName);
          if (existingPerson) {
            personId = existingPerson;
            if (cleanPhone) {
              await fetch(`${PIPEDRIVE_BASE}/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: [{ value: cleanPhone, primary: true }],
                  org_id: orgId,
                }),
              });
            }
          } else {
            const personData: Record<string, unknown> = {
              name: displayName,
              first_name: firstName,
              last_name: lastName,
              org_id: orgId,
            };
            if (cleanPhone) {
              personData.phone = [{ value: cleanPhone, primary: true }];
            }
            if (personAddress) {
              personData.address = personAddress;
            }
            const personRes = await pipedrivePost('/persons', PIPEDRIVE_API_TOKEN, personData);
            personId = personRes?.data?.id;
          }
        }

        // 3. Create Person (owner 2) if exists
        if (prop.owner_name_2) {
          const { firstName: fn2, lastName: ln2 } = parseOwnerForPipedrive(prop.owner_name_2);
          const displayName2 = fn2 ? `${fn2} ${ln2}` : ln2;
          const cleanPhone2 = cleanPhoneNumber(prop.owner_phone_2);
          const ownerStreet2 = extractStreetFromAddress(prop.owner_name_2);
          const personAddress2 = prop.owner_address_2 || ownerStreet2;

          const existing2 = await findExistingPerson(PIPEDRIVE_API_TOKEN, displayName2);
          if (!existing2) {
            const personData2: Record<string, unknown> = {
              name: displayName2,
              first_name: fn2,
              last_name: ln2,
              org_id: orgId,
            };
            if (cleanPhone2) {
              personData2.phone = [{ value: cleanPhone2, primary: true }];
            }
            if (personAddress2) {
              personData2.address = personAddress2;
            }
            await pipedrivePost('/persons', PIPEDRIVE_API_TOKEN, personData2);
          }
        }

        // 4. Get or create zone label
        const labelId = await ensureZoneLabel(PIPEDRIVE_API_TOKEN, prop.zone || '', labelCache);

        // 5. Build lead note with property details
        const noteLines: string[] = [];
        noteLines.push(`📍 Adresse: ${prop.address}${prop.plz_ort ? ', ' + prop.plz_ort : ''}`);
        if (prop.area) noteLines.push(`📐 Grundstück: ${Math.round(prop.area)} m²`);
        if (prop.gebaeudeflaeche) noteLines.push(`🏠 Gebäudefläche: ${Math.round(prop.gebaeudeflaeche)} m²`);
        if (prop.baujahr) noteLines.push(`📅 Baujahr: ${prop.baujahr}`);
        if (prop.geschosse) noteLines.push(`🏗 Geschosse: ${prop.geschosse}`);
        if (prop.zone) noteLines.push(`🗺 Zone: ${prop.zone}`);
        if (prop.gemeinde) noteLines.push(`🏘 Gemeinde: ${prop.gemeinde}`);
        if (prop.egrid) noteLines.push(`EGRID: ${prop.egrid}`);
        if (prop.gwr_egid) noteLines.push(`EGID: ${prop.gwr_egid}`);
        if (prop.notes) noteLines.push(`\n📝 Notizen: ${prop.notes}`);

        // 6. Create Lead (without note - deprecated field)
        const leadData: Record<string, unknown> = {
          title: leadTitle,
          person_id: personId,
          organization_id: orgId,
        };
        if (labelId) {
          leadData.label_ids = [labelId];
        }

        const leadRes = await pipedrivePost('/leads', PIPEDRIVE_API_TOKEN, leadData);
        const leadId = leadRes?.data?.id;

        if (!leadId) {
          results.push({ propertyId: prop.id, error: `Lead creation failed: ${JSON.stringify(leadRes)}` });
          continue;
        }

        // 7. Add note via Notes API (lead notes require lead_id)
        if (noteLines.length > 0) {
          await pipedrivePost('/notes', PIPEDRIVE_API_TOKEN, {
            lead_id: leadId,
            content: noteLines.join('<br>'),
          });
        }

        results.push({ propertyId: prop.id, leadId, personId, orgId: orgId || undefined });
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
