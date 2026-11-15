// Jeder neue Lead sofort in Pipedrive, mit Anruf-Aufgabe.
//
// Julian, 15. November: «mach Nummer 1» (Sofort-Meldung bei neuem Lead).
// Wer eine Analyse anfordert, ist in diesem Moment interessiert; der Anruf
// innert Minuten zählt. Der Auslöser anfrage_melden (Migration
// 20261115160000 im Repository der Webseite) ruft diese Funktion bei jeder
// neuen Anfrage auf. Sie legt Person, Deal, Notiz und eine heute fällige
// Aufgabe «Anrufen» an; die Pipedrive-App meldet die Aufgabe auf dem Handy.
//
// Ohne Anmeldung aufrufbar (der Auslöser hat keine): Sie nimmt nur eine
// Kennung entgegen und überträgt nur eine Anfrage, die es gibt und die
// noch nicht übertragen ist. Testdaten (Name TEST, Quelle test) bleiben
// draussen, ausser sie tragen angaben.pipedrive_probe = true.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const PIPEDRIVE = 'https://api.pipedrive.com/v1';
// Kennungen aus dem Lauf «pipelines» (pipedrive-push): mit Nummer in die Akquise, sonst «Search».
const PIPELINE_AKQUISE = 20, STAGE_NEU = 82, PIPELINE_SEARCH = 24, STAGE_SUCHEN = 91;
const KOPF = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
const antwort = (status: number, daten: unknown) => new Response(JSON.stringify(daten), { status, headers: KOPF });

async function post(pfad: string, token: string, daten: unknown) {
  const r = await fetch(`${PIPEDRIVE}${pfad}?api_token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(daten) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.success) throw new Error(`${pfad}: HTTP ${r.status}`);
  return j.data;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
// Dieselben Texte wie ANTWORT_TEXT (src/lib/check-daten.ts) und ABSICHT_HEIZUNG (heizung.ts).
const TEXT: Record<string, Record<string, string>> = {
  eigentuemer: { allein: 'Ja, allein', gemeinsam: 'Ja, gemeinsam mit anderen', erbengemeinschaft: 'Ja, als Erbengemeinschaft',
    vertretung: 'Nein, ich vertrete den Eigentümer', nein: 'Nein' },
  absicht: { verkaufen: 'Verkaufen', bauen: 'Bauen, aus- oder umbauen', wert: 'Den Wert kennen', informieren: 'Nur informieren', ersetzen: 'Heizung ersetzen' },
  zeitraum: { '12': 'In den nächsten 12 Monaten', '36': 'In 1 bis 3 Jahren', offen: 'Noch offen' },
};
const chf = (x: unknown) => (Number(x) > 0 ? `CHF ${Math.round(Number(x)).toLocaleString('de-CH')}` : null);

function notiz(l: Record<string, unknown>, a: Record<string, unknown>): string {
  const zeilen: [string, unknown][] = [
    ['Seite', a.domain ?? a.marke], ['Thema', a.thema === 'heizung' ? 'Heizungs-Check' : null],
    ['Priorität', a.prioritaet], ['Eigentümer', TEXT.eigentuemer[String(a.eigentuemer)] ?? a.eigentuemer],
    ['Absicht', TEXT.absicht[String(a.absicht)] ?? a.absicht], ['Zeitraum', TEXT.zeitraum[String(a.zeitraum)] ?? a.zeitraum],
    ['Adresse', l.adresse], ['Gemeinde', a.gemeinde && a.kanton ? `${a.gemeinde} (${a.kanton})` : a.gemeinde],
    ['Parzelle', a.parzelle], ['EGRID', l.egrid], ['Grundstück', a.flaeche ? `${a.flaeche} m²` : null], ['Zone', a.zone],
    ['Boden-Richtwert', chf(a.boden_chf) ? `${chf(a.boden_chf)} (${a.landpreis_m2} CHF/m², amtliche Statistik)` : null],
    ['Gebäude', a.gebaeude], ['Wohnungen', a.wohnungen], ['Baujahr', a.baujahr ?? a.bauperiode], ['Heizung', a.heizung],
    ['Herkunft', a.utm_source ?? (a.fbclid ? 'facebook' : a.gclid ? 'google' : null)], ['Kampagne', a.utm_campaign],
  ];
  return `<b>Lead der Check-Seiten</b><br>${zeilen.filter(([, w]) => w != null && w !== '').map(([t, w]) => `${esc(t)}: ${esc(w)}`).join('<br>')}`;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: KOPF });
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return antwort(400, { fehler: 'id fehlt' });
  const token = Deno.env.get('PIPEDRIVE_API_TOKEN');
  if (!token) return antwort(500, { fehler: 'PIPEDRIVE_API_TOKEN fehlt' });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: l } = await db.from('anfrage').select('*').eq('id', id).maybeSingle();
  if (!l) return antwort(404, { fehler: 'unbekannt' });
  const a = (l.angaben ?? {}) as Record<string, unknown>;
  const test = /\bTEST\b/i.test(String(l.name ?? '')) || a.quelle === 'test';
  if (test && a.pipedrive_probe !== true) return antwort(200, { uebersprungen: 'Testdaten' });

  // Zuerst beanspruchen (0 = in Arbeit): ein zweiter Aufruf findet dann nichts mehr.
  const { data: frei } = await db.from('anfrage').update({ pipedrive_deal_id: 0 }).eq('id', id).is('pipedrive_deal_id', null).select('id');
  if (!frei?.length) return antwort(200, { uebersprungen: 'schon übertragen' });

  try {
    const name = String(l.name ?? 'Unbekannt').trim() || 'Unbekannt';
    const person = await post('/persons', token, {
      name,
      ...(l.email ? { email: [{ value: l.email, primary: true }] } : {}),
      ...(l.telefon ? { phone: [{ value: l.telefon, primary: true }] } : {}),
    });
    const mitNummer = !!l.telefon;
    const ort = a.gemeinde ? String(a.gemeinde) : String(l.adresse ?? '').split(',').pop()?.trim() ?? '';
    const deal = await post('/deals', token, {
      title: `Check: ${l.adresse ?? name}`,
      person_id: person.id,
      pipeline_id: mitNummer ? PIPELINE_AKQUISE : PIPELINE_SEARCH,
      stage_id: mitNummer ? STAGE_NEU : STAGE_SUCHEN,
    });
    await post('/notes', token, { deal_id: deal.id, content: notiz(l, a) });
    const jetzt = new Date();
    await post('/activities', token, {
      subject: `${a.prioritaet === 'heiss' ? 'Heiss: ' : ''}Anrufen: ${name}${ort ? `, ${ort}` : ''}`,
      type: 'call', deal_id: deal.id, person_id: person.id,
      due_date: jetzt.toISOString().slice(0, 10), due_time: jetzt.toISOString().slice(11, 16), duration: '00:15',
      note: mitNummer ? `Telefon: ${esc(l.telefon)}` : 'Keine Nummer angegeben: per E-Mail melden.',
    });
    await db.from('anfrage').update({ pipedrive_deal_id: deal.id }).eq('id', id);
    return antwort(200, { deal: deal.id });
  } catch (e) {
    // Freigeben, damit ein späterer Lauf es erneut versucht; nur die Stelle melden, keine Daten.
    await db.from('anfrage').update({ pipedrive_deal_id: null }).eq('id', id);
    console.error('lead-melden:', String(e).slice(0, 200));
    return antwort(502, { fehler: 'Pipedrive' });
  }
});
