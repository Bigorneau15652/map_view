// Catalogue of maps: the built-in base maps, the IGN layers and the maps added by the user.
// Every entry becomes a plain object with the same fields, whatever its origin:
//   id, title, source, url (tile template), attribution (safe HTML), minZoom, maxNativeZoom,
//   subdomains, theme, needsKey, custom, kind (`base` or `overlay`)
(function () {
  const IGN_ENDPOINT = `https://data.geopf.fr/wmts`;
  const THUMBNAIL_PLACE = { lat: 43.6112, lng: 3.8767 };
  const THUMBNAIL_ZOOM = 14;
  const SAMPLE_VALUES = { z: `5`, x: `15`, y: `10`, s: `a`, r: ``, [`-y`]: `10`, apikey: `key` };

  // Order of the themes in the menu.
  const THEMES = [
    `maps`, `aerial`, `cadastre`, `admin`, `relief`, `old`, `edugeo`, `landcover`, `water`,
    `forest`, `agri`, `transport`, `energy`, `nature`, `society`, `geology`, `other`
  ];

  // IGN layers shown first, with a preview image. Identifiers come from the Géoplateforme.
  const IGN_REFERENCE_IDS = [
    `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2`,
    `ORTHOIMAGERY.ORTHOPHOTOS`,
    `CADASTRALPARCELS.PARCELLAIRE_EXPRESS`,
    `ADMINEXPRESS-COG-CARTO.LATEST`,
    `IGNF_PLAN-IGN-HD`,
    `GEOGRAPHICALGRIDSYSTEMS.MAPS.BDUNI.J1`,
    `ORTHOIMAGERY.ORTHOPHOTOS.1950-1965`,
    `ORTHOIMAGERY.ORTHOPHOTOS.1965-1980`,
    `ORTHOIMAGERY.ORTHOPHOTOS.1980-1995`,
    `CADASTRALPARCELS.PARCELS`,
    `CADASTRALPARCELS.HISTO.2008-2013.PARCELS`,
    `GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN50.1950`,
    `GEOGRAPHICALGRIDSYSTEMS.ETATMAJOR40`,
    `BNF-IGNF_GEOGRAPHICALGRIDSYSTEMS.CASSINI`,
    `TRANSPORTNETWORKS.ROADS`,
    `IGNF_LIDARHD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW`,
    `IGNF_LIDARHD_MNS_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW`,
    `ELEVATION.SLOPES`,
    `ELEVATION.CONTOUR.LINE`,
    `GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN`,
    `GEOGRAPHICALGRIDSYSTEMS.COASTALMAPS`,
    `HYDROGRAPHY.HYDROGRAPHY`,
    `LANDCOVER.FORESTINVENTORY.V2`,
    `FORETS.PUBLIQUES`
  ];

  // Base maps that need no key and whose terms were checked (see MAPS.md).
  // Attributions are fixed texts written here, never user data.
  const OSM_COPYRIGHT = `&copy; <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>`;
  const BUILT_IN = [
    {
      id: `osm-standard`, title: `OpenStreetMap Standard`, source: `OpenStreetMap`,
      url: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`,
      attribution: OSM_COPYRIGHT, maxNativeZoom: 19, theme: `maps`
    },
    {
      id: `cyclosm`, title: `CyclOSM`, source: `OpenStreetMap France`,
      url: `https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png`, subdomains: `abc`,
      attribution: `<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" target="_blank" rel="noopener noreferrer">CyclOSM</a> | ${OSM_COPYRIGHT}`,
      maxNativeZoom: 20, theme: `maps`
    },
    {
      id: `opentopomap`, title: `OpenTopoMap`, source: `OpenTopoMap`,
      url: `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png`, subdomains: `abc`,
      attribution: `${OSM_COPYRIGHT} | &copy; <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a> (CC-BY-SA)`,
      maxNativeZoom: 17, theme: `relief`
    }
  ].map((entry) => Object.assign({ minZoom: 0, needsKey: false, custom: false }, entry));

  // ------------------------------------------------------------------ Helpers

  function escapeHtml(text) {
    const replacements = { [`&`]: `&amp;`, [`<`]: `&lt;`, [`>`]: `&gt;`, [`"`]: `&quot;`, [`'`]: `&#39;` };
    return String(text).replace(/[&<>"']/g, (c) => replacements[c]);
  }

  // Turns a row of the generated IGN data into a catalogue entry.
  function ignEntry(row) {
    const [layer, title, format, minZoom, maxZoom, style, theme, dataset] = row;
    const mime = format === `j` ? `image/jpeg` : `image/png`;
    const url = `${IGN_ENDPOINT}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
      `&LAYER=${encodeURIComponent(layer)}&STYLE=${encodeURIComponent(style)}` +
      `&FORMAT=${encodeURIComponent(mime)}&TILEMATRIXSET=PM_${minZoom}_${maxZoom}` +
      `&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}`;
    const link = dataset
      ? `<a href="https://cartes.gouv.fr/rechercher-unedonnee/dataset/${encodeURIComponent(dataset)}" target="_blank" rel="noopener noreferrer">IGN / Géoplateforme</a>`
      : `IGN / Géoplateforme`;
    return {
      id: `ign:${layer}`, title, url, attribution: `&copy; ${link}`,
      minZoom, maxNativeZoom: maxZoom, theme, needsKey: false, custom: false,
      source: ``, isIgn: true
    };
  }

  // Tile coordinates of a point at a zoom level (Web Mercator).
  function tileOf(lat, lng, zoom) {
    const n = 2 ** zoom;
    const x = Math.floor((lng + 180) / 360 * n);
    const rad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n);
    return { x, y };
  }

  // ------------------------------------------------------------ Custom maps

  // Checks the tile address typed by the user. Returns null when valid, otherwise
  // { code, name? } with code in `url`, `placeholders` or `other`.
  function validateTileUrl(text) {
    const trimmed = String(text || ``).trim();
    const markers = trimmed.match(/\{[^}]*\}/g) || [];
    for (const marker of markers) {
      const name = marker.slice(1, -1);
      if (!(name in SAMPLE_VALUES)) return { code: `other`, name: marker };
    }
    let probe = trimmed;
    for (const [name, sample] of Object.entries(SAMPLE_VALUES)) {
      probe = probe.split(`{${name}}`).join(sample);
    }
    let parsed;
    try {
      parsed = new URL(probe);
    } catch {
      return { code: `url` };
    }
    if (parsed.protocol !== `https:` || parsed.username || parsed.password) return { code: `url` };
    const hasY = trimmed.includes(`{y}`) || trimmed.includes(`{-y}`);
    if (!trimmed.includes(`{z}`) || !trimmed.includes(`{x}`) || !hasY) return { code: `placeholders` };
    return null;
  }

  function customEntry(item) {
    const needsKey = String(item.url).includes(`{apikey}`);
    let host = ``;
    try { host = new URL(String(item.url).split(`{`)[0] || item.url).hostname; } catch { host = ``; }
    return {
      id: item.id, title: String(item.name), url: String(item.url),
      attribution: escapeHtml(item.copyright || host), apiKey: String(item.key || ``),
      minZoom: 0, maxNativeZoom: 19, theme: `other`, needsKey,
      custom: true, source: host, kind: item.kind === `overlay` ? `overlay` : `base`,
      subdomains: `abc`
    };
  }

  // ------------------------------------------------------------- The catalogue

  const ignAll = (window.MAPVIEW_IGN_LAYERS || []).map(ignEntry);
  const byId = new Map();
  for (const entry of BUILT_IN) byId.set(entry.id, entry);
  for (const entry of ignAll) byId.set(entry.id, entry);

  const reference = IGN_REFERENCE_IDS
    .map((layer) => byId.get(`ign:${layer}`))
    .filter(Boolean);
  const referenceSet = new Set(reference);
  for (const entry of reference) entry.reference = true;

  // The tile address of a catalogue entry once its key (if any) is inserted.
  function tileUrl(entry) {
    if (!entry.needsKey) return entry.url;
    return entry.url.split(`{apikey}`).join(encodeURIComponent(entry.apiKey || ``));
  }

  // Address of the small preview image of a reference layer: one tile of Montpellier.
  function thumbnailUrl(entry) {
    const zoom = Math.min(entry.maxNativeZoom, Math.max(entry.minZoom, THUMBNAIL_ZOOM));
    const { x, y } = tileOf(THUMBNAIL_PLACE.lat, THUMBNAIL_PLACE.lng, zoom);
    return tileUrl(entry).replace(`{z}`, zoom).replace(`{x}`, x).replace(`{y}`, y);
  }

  window.mapViewCatalog = {
    THEMES,
    builtIn: BUILT_IN,
    ign: ignAll,
    reference,
    isReference: (entry) => referenceSet.has(entry),
    customEntry,
    validateTileUrl,
    tileUrl,
    thumbnailUrl,
    escapeHtml,
    // Finds an entry by id, looking in the user maps when it is a custom one.
    find(id, customMaps) {
      if (!id) return null;
      if (byId.has(id)) return byId.get(id);
      const item = (customMaps || []).find((m) => m.id === id);
      return item ? customEntry(item) : null;
    }
  };
})();
