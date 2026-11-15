// Die Datenbank-Bibliothek erst laden, wenn eine Check-Seite sie braucht
// (Zählen, Ziffern, Umkreis, Anfrage). Statisch eingebunden lud sie bei
// jedem Besuch vor dem ersten Bild mit (Lighthouse 15. November, 57 KB).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const datenbank = (): Promise<any> => import('@/integrations/supabase/client').then(m => m.supabase);
