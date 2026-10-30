// The view of the map (centre and zoom) as it is saved in the options of the widget. Nothing here touches
// the page or Grist: the saved value comes from the document, so it is checked before it is used.
(function (root) {
  const MIN_ZOOM = 0;
  const MAX_ZOOM = 20;
  const DECIMALS = 5;

  // The view saved in the options, or null when there is none or when it is damaged.
  function readSavedView(options) {
    const saved = options && typeof options === `object` ? options.view : null;
    if (!saved || typeof saved !== `object`) return null;
    const { lat, lng, zoom } = saved;
    const valid = [lat, lng, zoom].every((value) => typeof value === `number` && Number.isFinite(value));
    if (!valid || Math.abs(lat) > 90 || Math.abs(lng) > 180 || zoom < MIN_ZOOM || zoom > MAX_ZOOM) return null;
    return { lat, lng, zoom };
  }

  // The view as it is written in the options: rounded, so that two moves of a few millimetres are the same view.
  function roundView(view) {
    const round = (value) => Number(value.toFixed(DECIMALS));
    return { lat: round(view.lat), lng: round(view.lng), zoom: Math.round(view.zoom) };
  }

  const api = { readSavedView, roundView };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.mapViewView = api;
})(typeof window !== `undefined` ? window : globalThis);
