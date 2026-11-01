// Zeigt die Seite des Amtsblattportals das Gesuch? Sie laedt ihren Inhalt
// erst im Browser (Hash-Route) -- darum mit einem echten Browser.
import { chromium } from 'playwright';
// Mit `node -e` steht das erste Argument schon in argv[1]; darum von hinten.
const [id, nr] = process.argv.slice(-2);
const b = await chromium.launch();
for (const url of [
  `https://www.amtsblattportal.ch/#!/search/publications/detail/${id}`,
  `https://amtsblatt.zh.ch/#!/search/publications/detail/${id}`,
  `https://amtsblatt.zh.ch/#!/search/publications?text=${nr}`,
]) {
  const p = await b.newPage();
  try {
    await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); await p.waitForTimeout(4000);
    const t = await p.locator('body').innerText();
    console.log(`${url}\n  Nummer sichtbar: ${t.includes(nr)} | Titel: ${(await p.title()).slice(0, 80)} | Text: ${t.replace(/\s+/g, ' ').slice(0, 220)}`);
  } catch (e) { console.log(`${url}\n  Fehler: ${String(e).slice(0, 120)}`); }
  await p.close();
}
await b.close();
