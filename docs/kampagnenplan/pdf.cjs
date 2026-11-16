// Druckt den Plan als PDF (A4), mit Seitenzahl im Fuss.
//   python3 docs/kampagnenplan/plan.py   schreibt kampagnenplan.html (aus volumen.tsv)
//   node docs/kampagnenplan/pdf.cjs      druckt daraus das PDF
// Braucht Playwright und die Schrift Inter auf dem Rechner. Der Pfad zum
// Browser gilt für die Cloud-Umgebung; lokal CHROMIUM setzen oder weglassen.
const { chromium } = require('playwright');
(async () => {
  const fs = require('fs');
  const pfad = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(pfad ? { executablePath: pfad } : {});
  const seite = await browser.newPage();
  await seite.goto(`file://${__dirname}/kampagnenplan.html`, { waitUntil: 'load' });
  await seite.evaluate(() => document.fonts.ready);
  const schriften = await seite.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').length + ' geladen; h1: ' + getComputedStyle(document.querySelector('h1')).fontFamily);
  console.log(schriften);
  await seite.pdf({
    path: `${__dirname}/Kampagnenplan-Check-Seiten.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-family:Inter,sans-serif;font-size:7pt;color:#7b838c;padding:0 17mm;display:flex;justify-content:space-between"><span>Kampagnenplan Check-Seiten · 16. November 2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: '18mm', bottom: '18mm', left: '17mm', right: '17mm' },
  });
  await browser.close();
})();
