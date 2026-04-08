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

        // 2. Find or create Person (owner 1)
        let personId: number | undefined;
        if (prop.owner_name) {
          const existingPerson = await findExistingPerson(PIPEDRIVE_API_TOKEN, prop.owner_name);
          if (existingPerson) {
            personId = existingPerson;
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

        // 3. Create Person (owner 2) if exists
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

        // 4. Create Lead (goes to "Neue Leads" inbox)
        const leadData: Record<string, unknown> = {
          title: leadTitle,
          person_id: personId,
          organization_id: orgId,
        };

        // Add note as lead note
        if (prop.notes) {
          leadData.note = prop.notes;
        }

        const leadRes = await pipedrivePost('/leads', PIPEDRIVE_API_TOKEN, leadData);
        const leadId = leadRes?.data?.id;

        if (!leadId) {
          results.push({ propertyId: prop.id, error: `Lead creation failed: ${JSON.stringify(leadRes)}` });
          continue;
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
