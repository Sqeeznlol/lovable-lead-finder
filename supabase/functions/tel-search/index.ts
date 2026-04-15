import { z } from 'https://esm.sh/zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BodySchema = z.object({
  lastName: z.string().min(1),
  firstName: z.string().optional().default(''),
  street: z.string().optional().default(''),
  streetNumber: z.string().optional().default(''),
  ort: z.string().optional().default(''),
});

function normalizeStreet(s: string): string {
  return s.toLowerCase()
    .replace(/strasse/g, 'str')
    .replace(/straße/g, 'str')
    .replace(/[.\-,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function streetsMatch(searchStreet: string, searchNumber: string, foundAddress: string): boolean {
  if (!searchStreet || !foundAddress) return false;
  const normSearch = normalizeStreet(searchStreet);
  const normFound = normalizeStreet(foundAddress);
  
  // Check if the street name appears in the found address
  if (!normFound.includes(normSearch) && !normSearch.includes(normFound.split(' ')[0])) {
    // Try partial match - first word of street
    const searchFirst = normSearch.split(' ')[0];
    if (searchFirst.length >= 4 && !normFound.includes(searchFirst)) {
      return false;
    }
  }
  
  // If we have a street number, check it appears too
  if (searchNumber) {
    if (!foundAddress.includes(searchNumber)) return false;
  }
  
  return true;
}

function formatSwissPhone(phone: string): string {
  let num = phone.replace(/[^\d+]/g, '');
  if (!num) return '';
  if (num.startsWith('0041')) num = '+41' + num.slice(4);
  else if (num.startsWith('41') && !num.startsWith('+')) num = '+' + num;
  else if (num.startsWith('0')) num = '+41' + num.slice(1);
  else if (!num.startsWith('+')) num = '+41' + num;
  return num;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { lastName, firstName, street, streetNumber, ort } = parsed.data;

    // Build search query: "Nachname Strasse Nr" for best matching
    const queryParts = [lastName];
    if (street) queryParts.push(street);
    if (streetNumber) queryParts.push(streetNumber);
    const query = queryParts.join(' ');

    const searchUrl = `https://search.ch/tel/?all=${encodeURIComponent(query)}`;
    console.log('Searching tel.search.ch:', searchUrl);

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-CH,de;q=0.9',
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `tel.search.ch returned ${res.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();

    // Extract phone numbers from tel: links
    const phoneMatches = [...html.matchAll(/href="tel:(\+\d+)"/g)];
    const phones = phoneMatches.map(m => formatSwissPhone(m[1]));

    // Extract address from map image alt text or address elements
    const addressMatch = html.match(/alt="([^"]*\d{4}[^"]*)"/);
    const foundAddress = addressMatch ? addressMatch[1] : '';

    // Check result count
    const countMatch = html.match(/<span class="tel-result-count">(\d+)<\/span>/);
    const resultCount = countMatch ? parseInt(countMatch[1]) : 0;

    // Check name match - the result page URL contains the name
    const nameInUrl = html.match(/search\.ch\/tel\/[^"]*\/([^"#?]+)/);
    const foundNameSlug = nameInUrl ? nameInUrl[1] : '';

    // Determine if it's a match
    const hasPhone = phones.length > 0;
    const streetMatches = street ? streetsMatch(street, streetNumber, foundAddress) : false;
    const isMatch = hasPhone && (streetMatches || resultCount === 1);

    console.log('Results:', { resultCount, phones, foundAddress, streetMatches, isMatch, foundNameSlug });

    return new Response(JSON.stringify({
      success: true,
      match: isMatch,
      phone: isMatch ? phones[0] : null,
      allPhones: phones,
      resultCount,
      foundAddress,
      searchUrl,
      streetMatches,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('tel-search error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
