/**
 * Eine Liste mit begrenzter Gleichzeitigkeit abarbeiten. Nacheinander
 * dauern 1000 Adressen beim Bund Minuten; alle zugleich drosselt er.
 * Vier zugleich ist das Mittel.
 */
export async function parallel<T>(liste: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const arbeiter = Array.from({ length: Math.min(n, liste.length) }, async () => {
    while (i < liste.length) { const x = liste[i++]; await fn(x); }
  });
  await Promise.all(arbeiter);
}

