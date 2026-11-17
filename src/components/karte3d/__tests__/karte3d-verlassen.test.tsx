import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Julian, 17. November: "die 3D-Ansicht ist mega langsam und dann stockt
 * die ganze Webseite". Nachgemessen: nach "Zurück" war die ganze Seite
 * leer. Beim Verlassen wird zuerst der Viewer zerstört, danach lief noch
 * das Aufräumen der Umrisse und fasste ihn an -- der Fehler riss die
 * ganze Anwendung mit, weil ihr Auffang im selben Zug verschwindet.
 *
 * Cesium braucht WebGL. Hier steht darum ein Ersatz, der jeden Zugriff
 * mitmacht, bis der Viewer zerstört ist: danach wirft er, strenger als
 * das echte Cesium, damit jede solche Stelle auffällt.
 */
const h = vi.hoisted(() => {
  (globalThis as unknown as { __CESIUM_BASIS__: string }).__CESIUM_BASIS__ = '/cesium';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const egal: any = new Proxy(function () { /* macht alles mit */ }, {
    get: (_z, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : egal),
    apply: () => egal, construct: () => egal, set: () => true,
  });
  const zustand = {
    zerstoert: 0, danach: [] as string[], kachelGeladen: [] as ((kachel: unknown) => void)[], tabellen: [] as string[],
    antworten: {} as Record<string, unknown[]>,
  };
  class Viewer {
    constructor() {
      let weg = false;
      return new Proxy(this, {
        get: (_o, k) => {
          if (k === 'isDestroyed') return () => weg;
          if (k === 'destroy') return () => { weg = true; zustand.zerstoert++; };
          if (weg) { zustand.danach.push(String(k)); throw new TypeError(`Viewer ist zerstört: ${String(k)}`); }
          return egal;
        },
        set: () => true,
      });
    }
  }
  const Cesium3DTileset = {
    fromUrl: async () => new Proxy({}, {
      get: (_o, k) => (k === 'then' ? undefined
        : k === 'tileLoad' ? { addEventListener: (f: (kachel: unknown) => void) => zustand.kachelGeladen.push(f) }
          : k === 'isDestroyed' ? () => false : egal),
      set: () => true,
    }),
  };
  return { egal, zustand, Viewer, Cesium3DTileset };
});

vi.mock('cesium/Build/Cesium/Widgets/widgets.css', () => ({}));
vi.mock('cesium', () => {
  const e = h.egal;
  return {
    BoundingSphere: e, CameraEventType: e, Cartesian2: e, Cartesian3: e, Cartographic: e, Cesium3DTileColorBlendMode: e,
    Cesium3DTileFeature: e, Cesium3DTileStyle: e, Cesium3DTileset: h.Cesium3DTileset, CesiumTerrainProvider: e,
    ClassificationType: e, Color: e, ColorMaterialProperty: e, ConstantProperty: e, createGooglePhotorealistic3DTileset: e,
    Credit: e, Entity: e, GeoJsonDataSource: e, HeadingPitchRange: e, ImageryLayer: e, Ion: e, JulianDate: e,
    KeyboardEventModifier: e, Math: e, PolygonHierarchy: e, Ray: e, Rectangle: e, sampleTerrainMostDetailed: e,
    ScreenSpaceEventHandler: e, ScreenSpaceEventType: e, ShadowMode: e, UrlTemplateImageryProvider: e, Viewer: h.Viewer,
  };
});
vi.mock('@/integrations/supabase/client', () => {
  const kette = (tabelle: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const k: any = new Proxy({}, {
      get: (_o, name) => (name === 'then'
        ? (ja: (x: unknown) => unknown) => Promise.resolve({ data: h.zustand.antworten[tabelle] ?? [], error: null }).then(ja)
        : () => k),
    });
    return k;
  };
  return { supabase: { from: (tabelle: string) => { h.zustand.tabellen.push(tabelle); return kette(tabelle); } } };
});

import { Karte3D } from '@/components/karte3d/Karte3D';

const UMRISS = { type: 'Polygon', coordinates: [[[8.48, 47.37], [8.49, 47.37], [8.49, 47.38], [8.48, 47.37]]] };
const MARKIERT = [{ egrid: 'CH123456789012', farbe: '#3D45F5' }];
const zeigen = (markiert = MARKIERT) => render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <Karte3D ziel={{ lat: 47.379, lon: 8.488 }} markiert={markiert} />
    </MemoryRouter>
  </QueryClientProvider>,
);
const KACHEL = { content: { featuresLength: 2, getFeature: (i: number) => ({ getProperty: () => 1000 + i }) } };
const gefragt = (tabelle: string) => h.zustand.tabellen.filter(t => t === tabelle).length;
const warten = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('3D-Karte verlassen', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); h.zustand.kachelGeladen.length = 0; h.zustand.tabellen.length = 0; h.zustand.antworten = {}; });

  it('fasst den zerstörten Viewer nicht mehr an und fragt die Datenbank nicht weiter', async () => {
    vi.stubGlobal('fetch', vi.fn(async (adresse: string) => (String(adresse).includes('MapServer/find')
      ? { ok: true, json: async () => ({ results: [{ geometry: UMRISS }] }) }
      : { ok: false, json: async () => ({}) })));
    const { unmount } = zeigen();
    await waitFor(() => expect(screen.queryByText(/3D-Modell wird geladen/)).toBeNull());
    // Der Umriss der markierten Parzelle ist gezeichnet: erst dann gibt es beim Verlassen etwas aufzuräumen.
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(a => String(a[0]).includes('MapServer/find'))).toBe(true));
    await warten(20);
    // Eine Kachel mit zwei Häusern kommt an: das Register dazu wird 350 ms später gefragt.
    expect(h.zustand.kachelGeladen.length).toBeGreaterThan(0);
    h.zustand.kachelGeladen.at(-1)!(KACHEL);
    h.zustand.tabellen.length = 0;

    expect(() => unmount()).not.toThrow();
    expect(h.zustand.zerstoert).toBeGreaterThan(0);
    await warten(500);
    expect(h.zustand.danach).toEqual([]);
    expect(gefragt('gebaeude')).toBe(0);
  });
});

describe('3D-Karte und die Datenbank', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); h.zustand.kachelGeladen.length = 0; h.zustand.tabellen.length = 0; h.zustand.antworten = {}; });

  // Gemessen am 17. November: beim blossen Ansehen 56 Mal das Register und 56 Mal die Reserve in 40 Sekunden.
  it('fragt Register und Reserve erst, wenn eine Färbung sie zeigt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    h.zustand.antworten = { gebaeude: [{ egid: 1000, egrid: 'CH1' }, { egid: 1001, egrid: 'CH2' }], properties: [{ egrid: 'CH1', hnf_delta: 200 }] };
    zeigen([]);
    await waitFor(() => expect(screen.queryByText(/3D-Modell wird geladen/)).toBeNull());
    expect(h.zustand.kachelGeladen.length).toBeGreaterThan(0);
    h.zustand.kachelGeladen.at(-1)!(KACHEL);
    await warten(500);
    // Im Modell zeigt die Karte nichts aus dem Register.
    expect(gefragt('gebaeude')).toBe(0);
    expect(gefragt('properties')).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Heizung' }));
    await waitFor(() => expect(gefragt('gebaeude')).toBe(1));
    await warten(500);
    // Die Reserve steht an der Parzelle und gehört zu einer anderen Färbung.
    expect(gefragt('properties')).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Reserve' }));
    await waitFor(() => expect(gefragt('properties')).toBe(1));
    await warten(800);
    // Einmal gefragt genügt.
    expect(gefragt('gebaeude')).toBe(1);
    expect(gefragt('properties')).toBe(1);
  });
});
