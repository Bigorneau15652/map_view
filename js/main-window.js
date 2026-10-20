// Entry point of the separate map window. It knows nothing about Grist: the widget that
// opened it sends the data, and receives back the pin clicks and the setting changes.
(function () {
  const { t } = window.mapViewI18n;
  const { normalizeConfig } = window.mapViewConfig;

  const opener = window.opener;
  const origin = location.origin;
  let columns = { lat: `Latitude`, lng: `Longitude` };

  function toWidget(type, payload) {
    if (opener && !opener.closed) opener.postMessage({ type, payload }, origin);
  }

  const app = new window.MapApp({
    onConfig: (patch) => toWidget(`mapview:config`, { patch }),
    onSelect: (id) => toWidget(`mapview:select`, { id }),
    onWindowButton: () => {
      toWidget(`mapview:dock`, {});
      window.close();
    }
  }, `window`);

  app.setDataMessage(t(`windowWaiting`));

  // Only the widget that opened this window may send messages to it.
  window.addEventListener(`message`, (event) => {
    if (event.source !== opener || event.origin !== origin || !event.data) return;
    const { type, payload } = event.data;
    if (type === `mapview:state` && payload) {
      columns = payload.columns || columns;
      app.setConfig(normalizeConfig(payload.config));
      app.setDataMessage(String(payload.message || ``));
      app.setData({ points: payload.points || [], invalid: payload.invalid || [], columns });
      app.select(payload.selectedId === undefined ? null : payload.selectedId, true);
    } else if (type === `mapview:select` && payload) {
      app.select(payload.id, true);
    }
  });

  window.addEventListener(`pagehide`, () => toWidget(`mapview:closed`, {}));
  toWidget(`mapview:window-ready`, {});
})();
