import { z } from 'https://esm.sh/zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1';

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

function extractStreetFromAddress(rawName: string | null | undefined): string {
  if (!rawName || !rawName.trim()) return '';
  const parts = rawName.trim().split(',').map(s => s.trim());
  const ownershipPatterns = ['alleineigentum', 'miteigentum', 'gesamteigentum', 'stockwerkeigentum'];
  const countryPatterns = ['schweiz', 'suisse', 'svizzera', 'switzerland', 'ch'];
  const addressParts = parts.slice(2).filter(p => {
    const lower = p.toLowerCase();
    return !ownershipPatterns.some(op => lower.includes(op)) && !countryPatterns.includes(lower);
  });
  return addressParts.join(', ');
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

// --- Build Lead Note with all property details ---

function buildLeadNote(prop: z.infer<typeof PropertySchema>): string {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prop.address + (prop.plz_ort ? ', ' + prop.plz_ort : ''))}`;
  const fullAddress = prop.address + (prop.plz_ort ? ', ' + prop.plz_ort : '');

  const lines: string[] = [];
  lines.push(`<b>Adresse:</b> ${fullAddress}`);
  if (prop.gemeinde) lines.push(`<b>Gemeinde:</b> ${prop.gemeinde}`);
  if (prop.zone) lines.push(`<b>Zone:</b> ${prop.zone}`);
  if (prop.baujahr) lines.push(`<b>Baujahr:</b> ${prop.baujahr}`);
  if (prop.gebaeudeflaeche) lines.push(`<b>HNF:</b> ${Math.round(prop.gebaeudeflaeche)} m²`);
  if (prop.area) lines.push(`<b>Grundstück:</b> ${Math.round(prop.area)} m²`);
  if (prop.geschosse) lines.push(`<b>Geschosse:</b> ${prop.geschosse}`);
  if (prop.egrid) lines.push(`<b>EGRID:</b> ${prop.egrid}`);
  if (prop.gwr_egid) lines.push(`<b>EGID:</b> ${prop.gwr_egid}`);
  lines.push(`<b>Maps:</b> <a href="${mapsUrl}">${fullAddress}</a>`);
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

    // Batch dedup
    const exportedAddresses = new Set<string>();
    const results: { propertyId: string; leadId?: string; personId?: number; orgId?: number; skipped?: boolean; error?: string }[] = [];

    for (const prop of parsed.data.properties) {
      try {
        // Batch-level dedup
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

        // 3. Find or create Person (owner 1)
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
                body: JSON.stringify({ phone: [{ value: cleanPhone, primary: true }], org_id: orgId }),
              });
            }
          } else {
            const personData: Record<string, unknown> = {
              name: displayName,
              first_name: firstName,
              last_name: lastName,
              org_id: orgId,
            };
            if (cleanPhone) personData.phone = [{ value: cleanPhone, primary: true }];
            if (personAddress) personData.address = personAddress;
            const personRes = await pipedrivePost('/persons', PIPEDRIVE_API_TOKEN, personData);
            personId = personRes?.data?.id;
          }
        }

        // 4. Person 2
        if (prop.owner_name_2) {
          const { firstName: fn2, lastName: ln2 } = parseOwnerForPipedrive(prop.owner_name_2);
          const displayName2 = fn2 ? `${fn2} ${ln2}` : ln2;
          const cleanPhone2 = cleanPhoneNumber(prop.owner_phone_2);
          const ownerStreet2 = extractStreetFromAddress(prop.owner_name_2);
          const personAddress2 = prop.owner_address_2 || ownerStreet2;

          const existing2 = await findExistingPerson(PIPEDRIVE_API_TOKEN, displayName2);
          if (!existing2) {
            const personData2: Record<string, unknown> = {
              name: displayName2, first_name: fn2, last_name: ln2, org_id: orgId,
            };
            if (cleanPhone2) personData2.phone = [{ value: cleanPhone2, primary: true }];
            if (personAddress2) personData2.address = personAddress2;
            await pipedrivePost('/persons', PIPEDRIVE_API_TOKEN, personData2);
          }
        }

        // 5. Create Lead (not Deal)
        const leadData: Record<string, unknown> = {
          title: leadTitle,
          person_id: personId,
          organization_id: orgId,
        };

        // Add note with all property details
        const noteContent = buildLeadNote(prop);
        leadData.note = noteContent;

        const leadRes = await pipedrivePost('/leads', PIPEDRIVE_API_TOKEN, leadData);
        const leadId = leadRes?.data?.id;

        if (!leadId) {
          console.error('Lead creation failed:', JSON.stringify(leadRes));
          results.push({ propertyId: prop.id, error: `Lead creation failed: ${JSON.stringify(leadRes)}` });
          continue;
        }

        exportedAddresses.add(prop.address);
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
