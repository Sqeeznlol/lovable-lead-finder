// Wer darf eine Funktion aufrufen?
//
// Sicherheitsprüfung, 1. November: Die Funktionen liefen mit
// --no-verify-jwt und prüften den Aufrufer nicht. Wer die Adresse kannte,
// konnte Deals in Pipedrive anlegen, SMS an beliebige Nummern schicken
// oder mit dem service_role Zonen beliebiger Objekte überschreiben. Die
// Prüfung des Gateways allein hälfe nicht: auch der öffentliche
// Schlüssel ist ein gültiges JWT. Darum fragt die Funktion GoTrue, ob
// hinter dem Schlüssel ein angemeldeter Mensch steht.

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

/** Das angemeldete Konto hinter der Anfrage, sonst null. */
export async function angemeldet(req: Request): Promise<{ id: string; token: string } | null> {
  const kopf = req.headers.get('Authorization') ?? '';
  const token = kopf.replace(/^Bearer\s+/i, '');
  if (!token || token === ANON) return null;
  const r = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u?.id ? { id: u.id, token } : null;
}

/** Ist das Konto Admin? Gefragt mit seinem eigenen Schlüssel, nach den Regeln der Datenbank. */
export async function istAdmin(k: { id: string; token: string }): Promise<boolean> {
  const r = await fetch(`${URL}/rest/v1/rpc/has_role`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${k.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ _user_id: k.id, _role: 'admin' }),
  });
  return r.ok && (await r.json().catch(() => false)) === true;
}

export const abgewiesen = (cors: Record<string, string>, status = 401) =>
  new Response(JSON.stringify({ error: status === 401 ? 'Nicht angemeldet' : 'Nicht erlaubt' }),
    { status, headers: { ...cors, 'Content-Type': 'application/json' } });
