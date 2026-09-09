/**
 * Das Lesezeichen, das eine Grundbuchauskunft übernimmt.
 *
 * Es ersetzt die Extension für alle, die nichts installieren wollen --
 * und vor allem: die Abfrage läuft im eigenen Browser, über den
 * eigenen Anschluss. Ein Server, der das täte, käme aus einem
 * Rechenzentrum; das ist etwas anderes, auch wenn dieselben Daten
 * herauskommen.
 *
 * Es liest den sichtbaren Text der Seite, sucht die Eigentümer und die
 * EGRID und öffnet wohntraums.life mit beidem im Adressteil hinter der
 * Raute. Dort steht es nicht im Verlauf des Servers -- alles hinter
 * "#" bleibt im Browser.
 *
 * Kein Schlüssel steckt darin: das Speichern macht die angemeldete
 * Sitzung auf der Seite, nicht das Lesezeichen.
 */
export function lesezeichenCode(ziel: string): string {
  const quelle = `(function(){
  var t = document.body.innerText || '';
  var i = t.search(/Eigent(ü|ue)mer(informationen|innen und Eigent)/i);
  var block = '';
  if (i >= 0) {
    var rest = t.slice(i).replace(/^[^\\n]*\\n/, '');
    var j = rest.search(/Zus(ä|ae)tzliche Informationen|Disclaimer|Bodenbedeckung|Grundbuch:/i);
    block = (j > 0 ? rest.slice(0, j) : rest.slice(0, 1500)).trim();
  }
  var sel = String(window.getSelection() || '').trim();
  if (!block && sel.length > 20) block = sel;
  if (!block) {
    alert('Bauraum: keine Eigentümer gefunden.\\n\\nDie Zeilen im Auszug markieren und nochmals klicken.');
    return;
  }
  var egrid = (t.match(/\\bCH\\d{12}\\b/) || [])[0] || '';
  var parz = (t.match(/Liegenschaft\\s+Nr\\.\\s*(\\S+)/i) || [])[1] || '';
  var daten = { text: block, egrid: egrid, parzelle: parz };
  window.open('${ziel}/#auskunft=' + encodeURIComponent(JSON.stringify(daten)), '_blank');
})();`;
  return 'javascript:' + encodeURIComponent(quelle.replace(/\s*\n\s*/g, ' '));
}
