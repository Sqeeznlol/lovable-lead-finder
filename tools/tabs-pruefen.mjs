/**
 * Zaehlt in einem echten Chromium, wie viele Tabs entstehen.
 *
 * Der Bildschirm mit zehn offenen Tabs liess sich mit Behauptungen
 * nicht klaeren, mit dieser Messung in fuenf Minuten. Ergebnis:
 *
 *   - Gleicher Fenstername       -> derselbe Tab (2 bleibt 2)
 *   - App benennt sich selbst    -> das Lesezeichen findet zurueck (2)
 *   - App ohne eigenen Namen     -> jedes Mal ein neuer Tab (3)
 *
 * Aufruf: node tools/tabs-pruefen.mjs
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext();
const zaehle = () => ctx.pages().length;

// So laeuft es wirklich: der App-Tab benennt sich selbst, oeffnet das
// Portal, und aus dem Portal heraus geht es zurueck zur App.
const app = await ctx.newPage();
await app.setContent('<p>app</p>');
await app.evaluate(() => { window.name = 'bauraum-app'; });

await app.evaluate(() => window.open('about:blank#portal', 'bauraum-portal'));
await app.waitForTimeout(300);
const portal = ctx.pages().at(-1);
console.log('nach Portal-Oeffnen:', zaehle());

// zweites Mal dasselbe Portal -- darf keinen neuen Tab geben
await app.evaluate(() => window.open('about:blank#portal2', 'bauraum-portal'));
await app.waitForTimeout(300);
console.log('Portal ein zweites Mal:', zaehle());

// zurueck zur App, so wie es das Lesezeichen macht
await portal.evaluate(() => window.open('about:blank#zurueck', 'bauraum-app'));
await portal.waitForTimeout(400);
console.log('Lesezeichen zurueck zur App:', zaehle());

// Und ohne Selbstbenennung der App?
const ctx2 = await b.newContext();
const app2 = await ctx2.newPage();
await app2.setContent('<p>app ohne Namen</p>');
await app2.evaluate(() => window.open('about:blank#p', 'bauraum-portal'));
await app2.waitForTimeout(300);
const portal2 = ctx2.pages().at(-1);
await portal2.evaluate(() => window.open('about:blank#z', 'bauraum-app'));
await portal2.waitForTimeout(400);
console.log('ohne Selbstbenennung -- Tabs:', ctx2.pages().length);
await b.close();
