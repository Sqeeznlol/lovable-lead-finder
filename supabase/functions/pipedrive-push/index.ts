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

// --- Custom Fields Management ---

interface FieldMap {
  // deal fields
  deal_zone?: string;
  deal_baujahr?: string;
  deal_hnf?: string;
  deal_grundstueck?: string;
  deal_geschosse?: string;
  deal_egrid?: string;
  deal_egid?: string;
  deal_gemeinde?: string;
  // org fields
  org_adresse?: string;
  org_plz_ort?: string;
  // person fields
  person_adresse?: string;
}

async function ensureCustomFields(token: string): Promise<FieldMap> {
  const fieldMap: FieldMap = {};

  // Get existing deal fields
  const dealFieldsRes = await pipedriveGet('/dealFields', token);
  const existingDealFields: { key: string; name: string }[] = dealFieldsRes?.data || [];

  const requiredDealFields: { name: string; mapKey: keyof FieldMap; field_type: string }[] = [
    { name: 'Zone', mapKey: 'deal_zone', field_type: 'varchar' },
    { name: 'Baujahr', mapKey: 'deal_baujahr', field_type: 'double' },
    { name: 'HNF m²', mapKey: 'deal_hnf', field_type: 'double' },
    { name: 'Grundstück m²', mapKey: 'deal_grundstueck', field_type: 'double' },
    { name: 'Geschosse', mapKey: 'deal_geschosse', field_type: 'double' },
    { name: 'EGRID', mapKey: 'deal_egrid', field_type: 'varchar' },
    { name: 'EGID', mapKey: 'deal_egid', field_type: 'varchar' },
    { name: 'Gemeinde', mapKey: 'deal_gemeinde', field_type: 'varchar' },
  ];

  for (const rf of requiredDealFields) {
    const existing = existingDealFields.find(f => f.name === rf.name);
    if (existing) {
      fieldMap[rf.mapKey] = existing.key;
    } else {
      const created = await pipedrivePost('/dealFields', token, { name: rf.name, field_type: rf.field_type });
      if (created?.data?.key) {
        fieldMap[rf.mapKey] = created.data.key;
      }
    }
  }

  return fieldMap;
}

// --- Pipeline Management ---

async function ensurePipeline(token: string): Promise<{ pipelineId: number; stageImportedId: number }> {
  // Check existing pipelines
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

  // Get stages for this pipeline
  const stagesRes = await pipedriveGet('/stages', token, { pipeline_id: String(pipelineId) });
  const stages: { id: number; name: string }[] = stagesRes?.data || [];

  let stageImportedId: number;
  const existingStage = stages.find(s => s.name === 'Importiert');
  if (existingStage) {
    stageImportedId = existingStage.id;
  } else {
    const created = await pipedrivePost('/stages', token, {
      name: 'Importiert',
      pipeline_id: pipelineId,
      order_nr: 1,
    });
    stageImportedId = created?.data?.id;
  }

  return { pipelineId, stageImportedId };
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

async function findExistingDeal(token: string, title: string): Promise<number | null> {
  const res = await pipedriveGet('/deals/search', token, {
    term: title,
    fields: 'title',
    exact_match: 'true',
  });
  const items = res?.data?.items || [];
  if (items.length > 0) {
    return items[0]?.item?.id || null;
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

    // Ensure custom fields and pipeline exist (cached per request batch)
    const [fieldMap, pipeline] = await Promise.all([
      ensureCustomFields(PIPEDRIVE_API_TOKEN),
      ensurePipeline(PIPEDRIVE_API_TOKEN),
    ]);

    const results: { propertyId: string; dealId?: number; personId?: number; orgId?: number; skipped?: boolean; error?: string }[] = [];

    for (const prop of parsed.data.properties) {
      try {
        // Title: "W5 · 320m² · Winterthur" format
        const titleParts = [
          prop.zone || '',
          prop.gebaeudeflaeche ? `${Math.round(prop.gebaeudeflaeche)}m²` : '',
          prop.gemeinde || prop.plz_ort || '',
        ].filter(Boolean);
        const dealTitle = titleParts.join(' · ') || prop.address;

        // 1. Check for duplicate deal
        const existingDealId = await findExistingDeal(PIPEDRIVE_API_TOKEN, dealTitle);
        if (existingDealId) {
          results.push({ propertyId: prop.id, dealId: existingDealId, skipped: true });
          continue;
        }

        // 2. Find or create Organization
        let orgId = await findExistingOrg(PIPEDRIVE_API_TOKEN, prop.address);
        if (!orgId) {
          const orgRes = await pipedrivePost('/organizations', PIPEDRIVE_API_TOKEN, {
            name: `Liegenschaft: ${prop.address}`,
            address: prop.address + (prop.plz_ort ? ', ' + prop.plz_ort : ''),
          });
          orgId = orgRes?.data?.id;
        }

        // 3. Find or create Person (owner 1)
        let personId: number | undefined;
        if (prop.owner_name) {
          const existingPerson = await findExistingPerson(PIPEDRIVE_API_TOKEN, prop.owner_name);
          if (existingPerson) {
            personId = existingPerson;
            // Update phone if we have it and they don't
            if (prop.owner_phone) {
              await fetch(`${PIPEDRIVE_BASE}/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: [{ value: prop.owner_phone, primary: true }],
                  org_id: orgId,
                }),
              });
            }
          } else {
            const personRes = await pipedrivePost('/persons', PIPEDRIVE_API_TOKEN, {
              name: prop.owner_name,
              phone: prop.owner_phone ? [{ value: prop.owner_phone, primary: true }] : undefined,
              org_id: orgId,
              ...(prop.owner_address ? { address: prop.owner_address } : {}),
            });
            personId = personRes?.data?.id;
          }
        }

        // 4. Create Person (owner 2) if exists
        if (prop.owner_name_2) {
          const existing2 = await findExistingPerson(PIPEDRIVE_API_TOKEN, prop.owner_name_2);
          if (!existing2) {
            await pipedrivePost('/persons', PIPEDRIVE_API_TOKEN, {
              name: prop.owner_name_2,
              phone: prop.owner_phone_2 ? [{ value: prop.owner_phone_2, primary: true }] : undefined,
              org_id: orgId,
              ...(prop.owner_address_2 ? { address: prop.owner_address_2 } : {}),
            });
          }
        }

        // 5. Determine stage based on status
        let stageId = pipeline.stageNewId;
        if (prop.status === 'Kontaktiert') stageId = pipeline.stageContactedId;
        if (prop.status === 'Interesse' || prop.status === 'Interessant') stageId = pipeline.stageInterestedId;

        // 6. Create Deal with custom fields
        const dealData: Record<string, unknown> = {
          title: dealTitle,
          person_id: personId,
          org_id: orgId,
          pipeline_id: pipeline.pipelineId,
          stage_id: stageId,
          status: 'open',
        };

        // Map custom fields
        if (fieldMap.deal_zone && prop.zone) dealData[fieldMap.deal_zone] = prop.zone;
        if (fieldMap.deal_baujahr && prop.baujahr) dealData[fieldMap.deal_baujahr] = prop.baujahr;
        if (fieldMap.deal_hnf && prop.gebaeudeflaeche) dealData[fieldMap.deal_hnf] = Math.round(prop.gebaeudeflaeche);
        if (fieldMap.deal_grundstueck && prop.area) dealData[fieldMap.deal_grundstueck] = Math.round(prop.area);
        if (fieldMap.deal_geschosse && prop.geschosse) dealData[fieldMap.deal_geschosse] = prop.geschosse;
        if (fieldMap.deal_egrid && prop.egrid) dealData[fieldMap.deal_egrid] = prop.egrid;
        if (fieldMap.deal_egid && prop.gwr_egid) dealData[fieldMap.deal_egid] = prop.gwr_egid;
        if (fieldMap.deal_gemeinde && prop.gemeinde) dealData[fieldMap.deal_gemeinde] = prop.gemeinde;

        const dealRes = await pipedrivePost('/deals', PIPEDRIVE_API_TOKEN, dealData);
        const dealId = dealRes?.data?.id;

        // 7. Add note if we have notes
        if (dealId && prop.notes) {
          await pipedrivePost('/notes', PIPEDRIVE_API_TOKEN, {
            deal_id: dealId,
            content: prop.notes,
          });
        }

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
