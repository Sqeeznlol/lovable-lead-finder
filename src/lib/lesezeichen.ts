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
 *
 * Steht noch kein Auszug auf dem Schirm, wählt es die Parzelle selbst
 * aus: Vorschlag anklicken, in die Karte klicken, warten. Das erspart
 * die zwei Klicks, die vorher dazwischenlagen.
 *
 * Nach dem Senden holt es die Anwendung nach vorn und schickt ihr den
 * Auszug ein zweites Mal als Nachricht. Das ist kein Guertel zum
 * Hosentraeger, sondern der Weg zurueck: an einer Nachricht haengt die
 * Absenderkennung, und damit kann die Anwendung genau diesen Tag zur
 * naechsten Parzelle schicken -- auch einen, den niemand von ihr
 * geoeffnet hat. Gemessen: ueber den Fensternamen allein geht das
 * nicht, da entsteht jedes Mal ein dritter Tag.
 *
 * Geschickt wird, bis die Anwendung bestaetigt, hoechstens zehn
 * Sekunden lang: beim ersten Mal laedt sie erst noch.
 *
 * Im erzeugten Code stehen keine Kommentare mit "//": er wird auf eine
 * Zeile gezogen, und ein solcher Kommentar verschluckt dann den Rest.
 */
export function lesezeichenCode(ziel: string): string {
  const quelle = `(function(){
  function text(){ return document.body.innerText || ''; }
  function auszug(){
    var t = text();
    var i = t.search(/Eigent(ü|ue)mer(informationen|innen und Eigent)/i);
    if (i < 0) return '';
    var rest = t.slice(i).replace(/^[^\\n]*\\n/, '');
    var j = rest.search(/Zus(ä|ae)tzliche Informationen|Disclaimer|Bodenbedeckung|Grundbuch:/i);
    return (j > 0 ? rest.slice(0, j) : rest.slice(0, 1500)).trim();
  }
  function melde(m){
    var d = document.getElementById('bauraum-hinweis') || document.createElement('div');
    d.id = 'bauraum-hinweis';
    d.style.cssText = 'position:fixed;z-index:2147483647;top:0;left:0;right:0;padding:8px 14px;background:#111;color:#fff;font:14px system-ui,sans-serif';
    d.textContent = 'Bauraum — ' + m;
    if (!d.parentNode) document.body.appendChild(d);
  }
  function senden(block){
    var t = text();
    var egrid = (t.match(/\\bCH\\d{12}\\b/) || [])[0] || '';
    var parz = (t.match(/Liegenschaft\\s+Nr\\.\\s*(\\S+)/i) || [])[1] || '';
    var daten = { text: block, egrid: egrid, parzelle: parz };
    melde('übernommen: ' + (egrid || 'ohne EGRID') + ' — wird eingetragen.');
    var app = window.open('${ziel}/#auskunft=' + encodeURIComponent(JSON.stringify(daten)), 'bauraum-app');
    if (app) {
      try { app.focus(); } catch (e) {}
      var n = 0;
      var uhr2 = setInterval(function(){
        try { app.postMessage({ bauraum: 'auskunft', daten: daten }, '${ziel}'); } catch (e) {}
        if (++n > 20) clearInterval(uhr2);
      }, 500);
      window.addEventListener('message', function(e){
        if (e.data && e.data.bauraum === 'erhalten') { clearInterval(uhr2); melde('eingetragen.'); }
      });
    }
  }
  function vorschlag(){
    var el = [].slice.call(document.querySelectorAll('li,a,div[role="option"],.ga-search-result,.tt-suggestion'));
    var t = el.filter(function(e){
      var x = (e.innerText || '').trim();
      return /\\bCH\\d{12}\\b/.test(x) && !/^projektiert/i.test(x);
    })[0];
    if (t) { t.click(); return true; }
    return false;
  }
  function karte(){
    var k = document.querySelector('.ol-viewport, canvas, #map, .ga-map');
    if (!k) return false;
    var r = k.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    ['pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(a){
      k.dispatchEvent(new MouseEvent(a, { bubbles:true, cancelable:true, clientX:x, clientY:y, view:window, button:0 }));
    });
    return true;
  }
  var sel = String(window.getSelection() || '').trim();
  var block = auszug() || (sel.length > 20 ? sel : '');
  if (block) { senden(block); return; }

  melde('Parzelle wird ausgewählt …');
  vorschlag();
  setTimeout(function(){
    karte();
    var n = 0;
    var uhr = setInterval(function(){
      var b = auszug();
      if (b) { clearInterval(uhr); senden(b); return; }
      if (++n > 30) {
        clearInterval(uhr);
        melde('kein Auszug erschienen. Parzelle anklicken, dann nochmals auf das Lesezeichen.');
      }
    }, 1000);
  }, 2500);
})();`;
  return 'javascript:' + encodeURIComponent(quelle.replace(/\s*\n\s*/g, ' '));
}
