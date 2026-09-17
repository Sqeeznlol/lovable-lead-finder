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
 * Die Nummer des Grundstuecks wird nicht irgendwo auf der Seite
 * gesucht, sondern in der Zeile, die sie mit der Parzelle zusammen
 * nennt: "Liegenschaft Nr. 447 ( CH627728290920 )". Die erste Nummer
 * auf der Seite ist naemlich nicht zwingend die des Auszugs -- so ist
 * Rudolf Gubler von der Grabenstrasse 12 bei der Alten
 * Basadingerstrasse 3 gelandet. Laesst sich die Zuordnung nicht
 * eindeutig lesen, wird nichts geschickt: kein Eintrag ist besser als
 * ein falscher.
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
export function lesezeichenCode(ziel: string, kanton = ''): string {
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
  function kennung(){
    var t = text();
    var i = t.search(/Grundbuch-Auszug|Eigent(ü|ue)mer(informationen|innen)/i);
    var j = t.search(/Disclaimer/i);
    var bereich = i < 0 ? t : t.slice(i, j > i ? j : i + 3000);
    var m = bereich.match(/Liegenschaft\\s+Nr\\.\\s*(\\S+?)\\s*\\(\\s*(CH\\d{12})\\s*\\)/i);
    if (m) return { parzelle: m[1], egrid: m[2] };
    var alle = bereich.match(/\\bCH\\d{12}\\b/g) || [];
    var eindeutig = alle.filter(function(x, k){ return alle.indexOf(x) === k; });
    if (eindeutig.length === 1) {
      var p = (bereich.match(/Liegenschaft\\s+Nr\\.\\s*(\\S+)/i) || [])[1] || '';
      return { parzelle: p, egrid: eindeutig[0] };
    }
    return null;
  }
  function senden(block, weiter){
    var k = kennung();
    if (!k) {
      melde('die Parzellennummer im Auszug ist nicht eindeutig — nichts übernommen.');
      if (weiter) weiter(false);
      return;
    }
    var egrid = k.egrid;
    var parz = k.parzelle;
    var daten = { text: block, egrid: egrid, parzelle: parz };
    melde('übernommen: Parzelle ' + parz + ' (' + egrid + ') — wird eingetragen.');
    var app = window.open('${ziel}/#auskunft=' + encodeURIComponent(JSON.stringify(daten)), 'bauraum-app');
    if (app) {
      try { app.focus(); } catch (e) {}
      var n = 0;
      var uhr2 = setInterval(function(){
        try { app.postMessage({ bauraum: 'auskunft', daten: daten }, '${ziel}'); } catch (e) {}
        if (++n > 20) clearInterval(uhr2);
      }, 500);
      var fertig = false;
      window.addEventListener('message', function(e){
        if (e.data && e.data.bauraum === 'erhalten' && !fertig) {
          fertig = true;
          clearInterval(uhr2);
          melde('eingetragen.');
          if (weiter) weiter(true);
        }
      });
      setTimeout(function(){
        if (!fertig && weiter) { fertig = true; clearInterval(uhr2); weiter(false); }
      }, 15000);
    } else if (weiter) { weiter(false); }
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
  function suchfeld(){
    var f = [].slice.call(document.querySelectorAll('input[type=text],input[type=search],input:not([type])'));
    return f.filter(function(e){
      var r = e.getBoundingClientRect();
      return r.width > 120 && r.height > 10 && e.offsetParent !== null;
    })[0] || null;
  }
  function eintippen(wert){
    var f = suchfeld();
    if (!f) return false;
    var setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (setzer && setzer.set) setzer.set.call(f, wert); else f.value = wert;
    f.focus();
    ['input','change','keyup'].forEach(function(a){
      f.dispatchEvent(new Event(a, { bubbles: true }));
    });
    f.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 }));
    return true;
  }
  function warte(pruefung, sekunden, dann){
    var n = 0;
    var uhr = setInterval(function(){
      if (pruefung()) { clearInterval(uhr); dann(true); return; }
      if (++n > sekunden) { clearInterval(uhr); dann(false); }
    }, 1000);
  }
  function eine(glied, nummer, gesamt, dann){
    var vorher = auszug();
    melde(nummer + ' von ' + gesamt + ': ' + (glied.address || glied.egrid) + ' wird gesucht …');
    if (!eintippen(glied.egrid)) { melde('kein Suchfeld gefunden.'); dann(false); return; }
    setTimeout(function(){
      vorschlag();
      setTimeout(function(){
        karte();
        warte(function(){
          var b = auszug();
          var k = kennung();
          return b && b !== vorher && k && k.egrid === glied.egrid;
        }, 30, function(gut){
          if (!gut) {
            melde(nummer + ' von ' + gesamt + ': kein Auszug zu ' + glied.egrid + ' — übersprungen.');
            dann(false);
            return;
          }
          senden(auszug(), function(){ dann(true); });
        });
      }, 2500);
    }, 1200);
  }
  function reiheAbarbeiten(reihe){
    var i = 0, gut = 0;
    function weiter(){
      if (i >= reihe.length) {
        melde('fertig: ' + gut + ' von ' + reihe.length + ' eingetragen.');
        return;
      }
      var glied = reihe[i];
      i = i + 1;
      eine(glied, i, reihe.length, function(erfolg){
        if (erfolg) gut = gut + 1;
        setTimeout(weiter, 1500);
      });
    }
    weiter();
  }
  function reiheHolen(){
    var app = window.open('${ziel}/', 'bauraum-app');
    if (!app) { melde('die Anwendung liess sich nicht öffnen — Popups erlauben.'); return; }
    var da = false;
    window.addEventListener('message', function(e){
      if (!e.data || e.data.bauraum !== 'reihe' || da) return;
      da = true;
      clearInterval(uhr3);
      var reihe = e.data.reihe || [];
      if (!reihe.length) { melde('nichts offen — es gibt nichts abzufragen.'); return; }
      melde(reihe.length + ' Grundstücke geholt. Es geht los.');
      try { window.focus(); } catch (e2) {}
      reiheAbarbeiten(reihe);
    });
    var m = 0;
    var uhr3 = setInterval(function(){
      try { app.postMessage({ bauraum: 'reihe-bitte', kanton: '${kanton}', anzahl: 20 }, '${ziel}'); } catch (e) {}
      if (++m > 20) {
        clearInterval(uhr3);
        if (!da) melde('die Anwendung antwortet nicht — ist wohntraums.life angemeldet?');
      }
    }, 500);
  }

  var sel = String(window.getSelection() || '').trim();
  var block = auszug() || (sel.length > 20 ? sel : '');
  if (block) { senden(block); return; }

  melde('Reihe wird geholt …');
  reiheHolen();
})();`;
  return 'javascript:' + encodeURIComponent(quelle.replace(/\s*\n\s*/g, ' '));
}
