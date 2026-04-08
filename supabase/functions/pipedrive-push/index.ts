import { z } from 'https://esm.sh/zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1';

// Pipedrive custom field keys (Deal fields)
const FIELD_ZONE = '6283f1bd5f9e2220c96dfebf3904e789c9850773';
const FIELD_BAUJAHR = 'd8e495e217d7f56099b33cf339612f0bb58bb2b7';
const FIELD_HNF = '7773ad912df15700b104f5057012a28cbc6b220a';
const FIELD_GRUNDSTUECK = 'caf47d7ebeb687f75a0d0e4a069073846f0a37b9';
const FIELD_GESCHOSSE = 'df02438b21bc6d823e3abf7dc7d4a71f2239724e';
const FIELD_EGRID = 'd210ce9334d6812187af1be8b71b7c97f6afd8db';
const FIELD_EGID = '0c81850c8b58b9d88b9ff57b919824bc8f7b6c91';
const FIELD_GEMEINDE = 'e9bd061887c619b93d0ad759dfbef11e55e4c58a';

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

// --- Pipeline Management ---

async function ensurePipeline(token: string): Promise<{ pipelineId: number; stageId: number }> {
  const pipelinesRes = await pipedriveGet('/pipelines', token);
  const pipelines: { id: number; name: string }[] = pipelinesRes?.data || [];

  let pipelineId: number;
  const existing = pipelines.find(p => p.name === 'Neue Leads');
  if (existing) {
    pipelineId = existing.id;
  } else {
    const created = await pipedrivePost('/pipelines', token, { name: 'Neue Leads', active: true });
    pipelineId = created?.data?.id;
  }

  const stagesRes = await pipedriveGet('/stages', token, { pipeline_id: String(pipelineId) });
  const stages: { id: number; name: string }[] = stagesRes?.data || [];

  let stageId: number;
  const existingStage = stages.find(s => s.name === 'Importiert');
  if (existingStage) {
    stageId = existingStage.id;
  } else {
    const created = await pipedrivePost('/stages', token, { name: 'Importiert', pipeline_id: pipelineId, order_nr: 1 });
    stageId = created?.data?.id;
  }

  return { pipelineId, stageId };
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

    // Ensure pipeline exists
    const pipeline = await ensurePipeline(PIPEDRIVE_API_TOKEN);

    // Batch dedup
    const exportedAddresses = new Set<string>();
    const results: { propertyId: string; dealId?: number; personId?: number; orgId?: number; skipped?: boolean; error?: string }[] = [];

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
        const dealTitle = titleParts.join(' · ') || prop.address;

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

          console.log('Person payload:', JSON.stringify({ displayName, firstName, lastName, cleanPhone, personAddress }));

          const existingPerson = await findExistingPerson(PIPEDRIVE_API_TOKEN, displayName);
          if (existingPerson) {
            personId = existingPerson;
            // Update existing person with latest phone + address + org
            const updatePayload: Record<string, unknown> = { org_id: orgId };
            if (cleanPhone) updatePayload.phone = [{ value: cleanPhone, primary: true }];
            if (personAddress) updatePayload.address = personAddress;
            const updateRes = await fetch(`${PIPEDRIVE_BASE}/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatePayload),
            });
            const updateJson = await updateRes.json();
            console.log('Person update result:', JSON.stringify(updateJson?.data?.id));
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
            console.log('Person created:', personId, JSON.stringify(personRes?.data));
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

        // 5. Create Deal with custom fields
        const dealData: Record<string, unknown> = {
          title: dealTitle,
          person_id: personId,
          org_id: orgId,
          pipeline_id: pipeline.pipelineId,
          stage_id: pipeline.stageId,
          status: 'open',
        };

        // Custom fields
        if (prop.zone) dealData[FIELD_ZONE] = prop.zone;
        if (prop.baujahr) dealData[FIELD_BAUJAHR] = prop.baujahr;
        if (prop.gebaeudeflaeche) dealData[FIELD_HNF] = Math.round(prop.gebaeudeflaeche);
        if (prop.area) dealData[FIELD_GRUNDSTUECK] = Math.round(prop.area);
        if (prop.geschosse) dealData[FIELD_GESCHOSSE] = prop.geschosse;
        if (prop.egrid) dealData[FIELD_EGRID] = prop.egrid;
        if (prop.gwr_egid) dealData[FIELD_EGID] = prop.gwr_egid;
        if (prop.gemeinde) dealData[FIELD_GEMEINDE] = prop.gemeinde;

        const dealRes = await pipedrivePost('/deals', PIPEDRIVE_API_TOKEN, dealData);
        const dealId = dealRes?.data?.id;

        if (!dealId) {
          console.error('Deal creation failed:', JSON.stringify(dealRes));
          results.push({ propertyId: prop.id, error: `Deal creation failed: ${JSON.stringify(dealRes)}` });
          continue;
        }

        // 6. Add note with additional details
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prop.address + (prop.plz_ort ? ', ' + prop.plz_ort : ''))}`;
        const noteLines: string[] = [];
        noteLines.push(`<b>Adresse:</b> ${prop.address}${prop.plz_ort ? ', ' + prop.plz_ort : ''}`);
        noteLines.push(`<b>Maps:</b> <a href="${mapsUrl}">Google Maps</a>`);
        if (prop.notes) noteLines.push(`<br/><b>Notizen:</b> ${prop.notes}`);

        await pipedrivePost('/notes', PIPEDRIVE_API_TOKEN, {
          deal_id: dealId,
          content: noteLines.join('<br/>'),
        });

        exportedAddresses.add(prop.address);
        results.push({ propertyId: prop.id, dealId, personId, orgId: orgId || undefined });
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
