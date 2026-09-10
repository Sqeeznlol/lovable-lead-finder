import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { zoneKurzform } from '@/lib/potential';
import { verkauftNie } from '@/lib/grundbuch';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Property = Tables<'properties'>;

interface UsePropertiesOptions {
  statusFilter?: string;
  gemeindeFilter?: string;
  zoneFilter?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  baujahrVon?: number;
  baujahrBis?: number;
  flaecheMin?: number;
  flaecheMax?: number;
  areaMin?: number;
  areaMax?: number;
  geschosseMin?: number;
  ownerFilter?: string;
  listId?: string | null;
}

function applyPropertyFilters(query: any, options: UsePropertiesOptions) {
  const {
    statusFilter,
    gemeindeFilter,
    zoneFilter,
    search,
    baujahrVon,
    baujahrBis,
    flaecheMin,
    flaecheMax,
    areaMin,
    areaMax,
    geschosseMin,
    ownerFilter,
    listId,
  } = options;

  let nextQuery = query.eq('geb_status', 'Bestehend');

  if (zoneFilter && zoneFilter !== 'Alle') {
    nextQuery = nextQuery.like('zone', 'W%');
  }

  if (statusFilter && statusFilter !== 'Alle') {
    nextQuery = nextQuery.eq('status', statusFilter);
  } else {
    nextQuery = nextQuery.neq('status', 'Ausgeblendet');
  }
  if (gemeindeFilter && gemeindeFilter !== 'Alle') nextQuery = nextQuery.eq('gemeinde', gemeindeFilter);
  if (zoneFilter && zoneFilter !== 'Alle') nextQuery = nextQuery.eq('zone', zoneFilter);
  if (search) nextQuery = nextQuery.or(`address.ilike.%${search}%,egrid.ilike.%${search}%,owner_name.ilike.%${search}%,gemeinde.ilike.%${search}%,strassenname.ilike.%${search}%`);
  if (baujahrVon) nextQuery = nextQuery.gte('baujahr', baujahrVon);
  if (baujahrBis) nextQuery = nextQuery.lte('baujahr', baujahrBis);
  if (flaecheMin) nextQuery = nextQuery.gte('gebaeudeflaeche', flaecheMin);
  if (flaecheMax) nextQuery = nextQuery.lte('gebaeudeflaeche', flaecheMax);
  if (areaMin) nextQuery = nextQuery.gte('area', areaMin);
  if (areaMax) nextQuery = nextQuery.lte('area', areaMax);
  if (geschosseMin) nextQuery = nextQuery.gte('geschosse', geschosseMin);
  if (ownerFilter === 'mit') nextQuery = nextQuery.not('owner_name', 'is', null);
  if (ownerFilter === 'ohne') nextQuery = nextQuery.is('owner_name', null);
  if (listId) nextQuery = nextQuery.eq('list_id', listId);

  return nextQuery;
}

export async function fetchAllProperties(options: UsePropertiesOptions = {}) {
  const batchSize = 1000;
  let from = 0;
  let rows: Property[] = [];

  while (true) {
    const query = applyPropertyFilters(
      supabase
        .from('properties')
        .select('*')
        .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
        .order('area', { ascending: false, nullsFirst: false })
        .range(from, from + batchSize - 1),
      options,
    );

    const { data, error } = await query;
    if (error) throw error;
    const batch = (data || []) as Property[];
    rows = rows.concat(batch);
    if (batch.length < batchSize) break;
    from += batchSize;
  }

  return rows;
}

export function useProperties(options: UsePropertiesOptions = {}) {
  const { page = 0, pageSize = 50 } = options;
  return useQuery({
    queryKey: ['properties', options],
    queryFn: async () => {
      const query = applyPropertyFilters(
        supabase
          .from('properties')
          .select('*', { count: 'exact' })
          .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
          .order('area', { ascending: false, nullsFirst: false })
          .range(page * pageSize, (page + 1) * pageSize - 1),
        options,
      );

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as Property[], count: count || 0 };
    },
  });
}

export function useGemeinden() {
  return useQuery({
    queryKey: ['gemeinden'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('gemeinde')
        .not('gemeinde', 'is', null);
      if (error) throw error;
      const unique = [...new Set(data.map(d => d.gemeinde).filter(Boolean))].sort() as string[];
      return unique;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Die Zonentypen für den Filter -- W2, W3, K, Z und so weiter.
 *
 * Im Kataster steht die Zone als Fliesstext mit dem Flächenanteil an genau
 * dieser Parzelle: "Wohnzone 2.4 (rechtskräftig, 8460m², 95%)". Ungefiltert
 * ergäbe das für jedes Grundstück einen eigenen Eintrag -- eine Auswahlliste
 * mit Zehntausenden Zeilen, in der nichts zu finden ist. Gruppiert wird
 * deshalb auf den Zonentyp, und genau danach filtert die Vorauswahl.
 */
export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      // Eine Stichprobe genügt: es gibt rund zwei Dutzend Zonentypen, die in
      // den ersten Tausenden Zeilen alle vorkommen. Der ganze Bestand wäre
      // eine Abfrage über Hunderttausende Zeilen für dieselbe Antwort.
      const { data, error } = await supabase
        .from('properties')
        .select('zone')
        .not('zone', 'is', null)
        .limit(20000);
      if (error) throw error;

      const typen = new Set<string>();
      for (const d of data) {
        const kurz = zoneKurzform(d.zone);
        if (kurz) typen.add(kurz);
      }

      // Wohnzonen zuerst und nach Geschosszahl geordnet -- so wird die Liste
      // gelesen. Alles Übrige alphabetisch dahinter.
      return [...typen].sort((a, b) => {
        const wa = /^W(\d)/.exec(a), wb = /^W(\d)/.exec(b);
        if (wa && wb) return Number(wa[1]) - Number(wb[1]);
        if (wa) return -1;
        if (wb) return 1;
        return a.localeCompare(b, 'de-CH');
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnqueriedProperties(limit: number, listId?: string | null, isPrioList?: boolean, gemeinde?: string | null, kanton?: string | null) {
  return useQuery({
    queryKey: ['properties', 'unqueried', limit, listId, isPrioList, gemeinde, kanton],
    queryFn: async () => {
      let query = supabase
        .from('properties')
        .select('*')
        .eq('is_queried', false)
        .not('status', 'in', '("Ausgeblendet","Nicht interessant","Vorausgewählt")')
        .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
        .order('area', { ascending: false, nullsFirst: false })
        .limit(limit);
      // For PRIO lists, skip status/baujahr filters entirely
      if (!isPrioList) {
        // Zürich schreibt "Bestehend", der Thurgau "Gebäude bestehend".
        // Der genaue Vergleich liess deshalb jedes Thurgauer Objekt
        // heraus -- der Akquise-Modus war dort leer, ohne dass es
        // jemandem gesagt wurde.
        query = query.ilike('geb_status', '%bestehend%');
      }
      if (listId) query = query.eq('list_id', listId);
      if (gemeinde) query = query.eq('gemeinde', gemeinde);
      // Ohne den Kanton mischt die Prüfliste Zürich und Thurgau --
      // oben umschalten hätte dann keine Wirkung.
      if (kanton) query = query.eq('kanton', kanton);
      const { data, error } = await query;
      if (error) throw error;
      return data as Property[];
    },
  });
}

/**
 * Die Objekte, bei denen nur noch die Nummer fehlt.
 *
 * Sie müssen eigens geholt werden. Die Warteschlange des Akquise-Modus
 * nimmt die zweihundert grössten Gebäude und filtert erst danach --
 * ein Objekt, dessen Eigentümer gestern eingetragen wurde, steht in
 * dieser Rangfolge irgendwo bei fünftausend und kam nie mit. Es war
 * also nicht "nicht im Modus", es war nie geladen.
 *
 * Hier zählt nicht die Grösse, sondern der Zustand: Eigentümer
 * bekannt, Nummer offen. Das sind wenige, und sie gehören nach vorn.
 */
/** Nur was die beiden Listen zeigen -- nicht neunzig Spalten. */
const LISTENFELDER =
  'id, address, plz, plz_ort, gemeinde, kanton, parzelle, egrid, bfs_nr, ' +
  'owner_name, owner_address, owner_phone, marge_chf, preselection_status, ' +
  'pipedrive_deal_id, last_export_at';

export function useOffeneNummern(limit = 200) {
  return useQuery({
    queryKey: ['properties', 'offene-nummern', limit],
    queryFn: async () => {
      // Getrennt wird hier, nicht in der Abfrage.
      //
      // "leer oder null" liess sich in PostgREST nur als
      // Oder-Verknuepfung schreiben, und deren Schreibweise fuer den
      // leeren Wert ist wacklig: schlaegt sie fehl, kommt eine leere
      // Liste zurueck, und niemand sieht einen Fehler. Es sind eine
      // Handvoll Zeilen -- die zu sortieren kostet nichts.
      const { data, error } = await supabase
        .from('properties')
        .select(LISTENFELDER)
        .is('pipedrive_deal_id', null)
        .not('owner_name', 'is', null)
        .neq('owner_name', '')
        .order('marge_chf', { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      return (data as unknown as Property[])
        .filter(p => !String(p.owner_phone ?? '').trim())
        .filter(p => p.preselection_status !== 'Ausschliessen')
        .slice(0, limit);
    },
    staleTime: 15 * 1000,
  });
}

/**
 * Was fertig ist und auf den Deal wartet.
 *
 * Eigentuemer da, Nummer da, noch keine Deal-Nummer. Dieser Zustand
 * war nirgends zu sehen: die Objekte verliessen "Nummern" und tauchten
 * in Pipedrive auf -- wenn der Push gelang.
 */
export function useBereitFuerPipedrive(limit = 200) {
  return useQuery({
    queryKey: ['properties', 'bereit-pipedrive', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(LISTENFELDER)
        .is('pipedrive_deal_id', null)
        .not('owner_name', 'is', null)
        .neq('owner_name', '')
        .order('marge_chf', { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      return (data as unknown as Property[])
        .filter(p => !!String(p.owner_phone ?? '').trim())
        .filter(p => p.preselection_status !== 'Ausschliessen')
        // Die oeffentliche Hand verkauft nicht -- ein Deal dazu ist
        // eine Zeile, die niemand anruft.
        .filter(p => !verkauftNie(p.owner_name))
        .slice(0, limit);
    },
    staleTime: 15 * 1000,
  });
}

/**
 * Was schon uebertragen wurde.
 *
 * Nach dem Push verschwand die Zeile, und beim naechsten Mal war nicht
 * zu sehen, was gestern schon hinuebergegangen ist -- die Gefahr,
 * dasselbe zweimal zu schicken, entsteht genau dort.
 */
export function useUebertragen(limit = 30) {
  return useQuery({
    queryKey: ['properties', 'uebertragen', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(LISTENFELDER)
        .not('pipedrive_deal_id', 'is', null)
        .order('last_export_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as Property[];
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Wo der Anruf nicht geht: Brief.
 *
 * Nicht jede Nummer laesst sich finden -- alte Eintraege, Firmen ohne
 * Eintrag, Erbengemeinschaften. Statt solche Objekte ewig unter
 * "Nummern" stehen zu lassen, wandern sie auf Post.
 */
export function usePostObjekte(limit = 100) {
  return useQuery({
    queryKey: ['properties', 'post', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(LISTENFELDER + ', owners_json')
        .eq('status', 'Post')
        .is('pipedrive_deal_id', null)
        .order('marge_chf', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as Property[];
    },
    staleTime: 30 * 1000,
  });
}

export function usePreselectedProperties(limit: number, listId?: string | null) {
  return useQuery({
    queryKey: ['properties', 'preselected', limit, listId],
    queryFn: async () => {
      let query = supabase
        .from('properties')
        .select('*')
        .eq('status', 'Vorausgewählt')
        .eq('is_queried', false)
        .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
        .order('area', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (listId) query = query.eq('list_id', listId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Property[];
    },
  });
}




export function useInsertProperties() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (properties: TablesInsert<'properties'>[]) => {
      for (let i = 0; i < properties.length; i += 500) {
        const batch = properties.slice(i, i + 500);
        const { error } = await supabase.from('properties').insert(batch);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'properties'> & { id: string }) => {
      const { error } = await supabase.from('properties').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function usePropertyStats() {
  return useQuery({
    queryKey: ['properties', 'stats'],
    queryFn: async () => {
      const [{ count: total, error: totalError }, { count: withOwner, error: ownerError }] = await Promise.all([
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('geb_status', 'Bestehend'),
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('geb_status', 'Bestehend')
          .not('owner_name', 'is', null),
      ]);

      if (totalError) throw totalError;
      if (ownerError) throw ownerError;

      return {
        total: total || 0,
        queried: 0,
        withOwner: withOwner || 0,
        pending: 0,
        statuses: {},
        gemeinden: {},
      };
    },
    staleTime: 30 * 1000,
  });
}
