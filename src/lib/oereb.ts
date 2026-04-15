export function getOerebParzelleUrl(parzelle?: string | null, bfsNr?: string | null) {
  if (!parzelle || !bfsNr) return null;
  return `https://maps.zh.ch/?locate=parz&locations=${bfsNr},${parzelle}&topic=OerebKatasterZH`;
}
