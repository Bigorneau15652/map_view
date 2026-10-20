// The widget settings: defaults and a reader that always returns a complete, valid
// configuration, whatever was saved. Shared by the map screens and the catalogue window.
(function () {
  const catalog = window.mapViewCatalog;

  const DEFAULT_BASE_ID = `ign:GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2`;
  const DEFAULT_OPACITY = 0.7;
  const DEFAULT_ZOOM = 13;
  const MAX_CUSTOM_MAPS = 50;

  // Reads the saved options of the widget and returns a complete, valid configuration:
  // an unknown or damaged value falls back to its default instead of breaking the map.
  function normalizeConfig(options) {
    const source = options && typeof options === `object` ? options : {};
    const text = (value, max) => (typeof value === `string` ? value.slice(0, max) : ``);
    const customMaps = (Array.isArray(source.customMaps) ? source.customMaps : [])
      .filter((item) => item && typeof item.id === `string` && item.id.startsWith(`custom:`) &&
        typeof item.name === `string` && typeof item.url === `string` && !catalog.validateTileUrl(item.url))
      .slice(0, MAX_CUSTOM_MAPS)
      .map((item) => ({
        id: item.id.slice(0, 80), name: text(item.name, 80), url: item.url.slice(0, 500),
        copyright: text(item.copyright, 200), key: text(item.key, 200),
        kind: item.kind === `overlay` ? `overlay` : `base`
      }));
    const known = (id) => (typeof id === `string` && catalog.find(id, customMaps) ? id : null);
    const clampOpacity = (value, fallback) => {
      const number = Number(value);
      return Number.isFinite(number) ? Math.min(1, Math.max(0.1, number)) : fallback;
    };
    const zoom = Number(source.defaultZoom);
    return {
      baseId: known(source.baseId) || DEFAULT_BASE_ID,
      overlayId: known(source.overlayId),
      overlayOpacity: clampOpacity(source.overlayOpacity, DEFAULT_OPACITY),
      baseOpacity: clampOpacity(source.baseOpacity, 1),
      defaultZoom: Number.isFinite(zoom) ? Math.min(20, Math.max(1, Math.round(zoom))) : DEFAULT_ZOOM,
      showPopup: source.showPopup === undefined ? true : Boolean(source.showPopup),
      customMaps
    };
  }

  window.mapViewConfig = { normalizeConfig };
})();
