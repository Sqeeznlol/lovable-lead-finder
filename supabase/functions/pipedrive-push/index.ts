import { corsHeaders } from '@supabase/supabase-js/cors';
import { z } from 'https://esm.sh/zod@3.25.76';

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
  properties: z.array(PropertySchema).min(1).max(100),
});

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

    const results: { propertyId: string; dealId?: number; personId?: number; error?: string }[] = [];

    for (const prop of parsed.data.properties) {
      try {
        // 1. Create Organization
        const orgRes = await fetch(`${PIPEDRIVE_BASE}/organizations?api_token=${PIPEDRIVE_API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Liegenschaft: ${prop.address}`,
            address: prop.address + (prop.plz_ort ? ', ' + prop.plz_ort : ''),
          }),
        });
        const orgData = await orgRes.json();
        const orgId = orgData?.data?.id;

        // 2. Create Person (owner 1)
        let personId: number | undefined;
        if (prop.owner_name) {
          const personRes = await fetch(`${PIPEDRIVE_BASE}/persons?api_token=${PIPEDRIVE_API_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: prop.owner_name,
              phone: prop.owner_phone ? [{ value: prop.owner_phone, primary: true }] : undefined,
              org_id: orgId,
            }),
          });
          const personData = await personRes.json();
          personId = personData?.data?.id;
        }

        // 3. Create Person (owner 2) if exists
        if (prop.owner_name_2) {
          await fetch(`${PIPEDRIVE_BASE}/persons?api_token=${PIPEDRIVE_API_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: prop.owner_name_2,
              phone: prop.owner_phone_2 ? [{ value: prop.owner_phone_2, primary: true }] : undefined,
              org_id: orgId,
            }),
          });
        }

        // 4. Create Deal
        const noteLines = [
          `Zone: ${prop.zone || '-'}`,
          `Baujahr: ${prop.baujahr || '-'}`,
          `HNF: ${prop.gebaeudeflaeche ? Math.round(prop.gebaeudeflaeche) + ' m²' : '-'}`,
          `Grundstück: ${prop.area ? Math.round(prop.area) + ' m²' : '-'}`,
          `Geschosse: ${prop.geschosse || '-'}`,
          `EGRID: ${prop.egrid || '-'}`,
          `EGID: ${prop.gwr_egid || '-'}`,
          prop.notes ? `\nNotizen: ${prop.notes}` : '',
        ].filter(Boolean).join('\n');

        const dealRes = await fetch(`${PIPEDRIVE_BASE}/deals?api_token=${PIPEDRIVE_API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Akquise: ${prop.address}`,
            person_id: personId,
            org_id: orgId,
            status: 'open',
          }),
        });
        const dealData = await dealRes.json();
        const dealId = dealData?.data?.id;

        // 5. Add note to deal
        if (dealId) {
          await fetch(`${PIPEDRIVE_BASE}/notes?api_token=${PIPEDRIVE_API_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deal_id: dealId,
              content: noteLines,
            }),
          });
        }

        results.push({ propertyId: prop.id, dealId, personId });
      } catch (err) {
        results.push({ propertyId: prop.id, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
