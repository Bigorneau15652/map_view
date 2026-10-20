// Entry point of the Grist widget: connects Grist (columns, rows, options, selection) to the
// map, and optionally to the separate map window.
(function () {
  const { t } = window.mapViewI18n;
  const { normalize } = window.mapViewRecords;
  const { normalizeConfig } = window.mapViewConfig;

  // What the separate window needs to draw the same map.
  const shared = {
    points: [], invalid: [], columns: { lat: `Latitude`, lng: `Longitude` },
    selectedId: null, config: normalizeConfig({}), message: ``
  };

  // The separate map window.
  const link = new window.WindowLink(
    { page: `window.html`, name: `map-view-window`, width: 1200, height: 860 },
    () => ({ ...shared }),
    {
      onSelect: (id) => selectRow(id),
      onConfig: (patch) => app.change(patch),
      onClosed: () => app.setDocked(false)
    }
  );

  // The catalogue window, used when the widget is too small to hold the catalogue.
  const catalogLink = new window.WindowLink(
    { page: `catalog.html`, name: `map-view-catalogue`, width: 520, height: 820 },
    () => ({ config: shared.config }),
    { onConfig: (patch) => app.change(patch), onClosed: () => {} }
  );

  // Sends the settings to the catalogue window after any change.
  function pushConfig() {
    catalogLink.send(`mapview:state`, { config: shared.config });
  }

  // Moves the Grist cursor to a row (when a pin is clicked, in the widget or in the window).
  function selectRow(id) {
    shared.selectedId = id;
    if (grist.setCursorPos) grist.setCursorPos({ rowId: id }).catch(() => {});
  }

  const app = new window.MapApp({
    onConfig: (patch) => {
      shared.config = { ...app.config };
      // Each setting is saved as its own widget option.
      for (const [name, value] of Object.entries(patch)) grist.setOption(name, value);
      link.send(`mapview:state`, { ...shared });
      pushConfig();
    },
    onSelect: (id) => selectRow(id),
    onCatalogWindow: () => catalogLink.open(),
    // The same button opens the window, and puts the map back when it is already open.
    onWindowButton: () => {
      if (link.isOpen) {
        link.close();
        app.setDocked(false);
      } else if (link.open()) {
        app.setDocked(true);
      } else {
        app.setDataMessage(t(`windowBlocked`));
      }
    }
  }, `grist`);

  // ------------------------------------------------------------------- Grist

  const optional = true;
  grist.ready({
    requiredAccess: `read table`,
    columns: [
      `Name`,
      { name: `Longitude`, title: t(`columnLongitude`), type: `Numeric` },
      { name: `Latitude`, title: t(`columnLatitude`), type: `Numeric` },
      { name: `Description`, title: t(`columnDescription`), type: `Text`, optional },
      { name: `Color`, title: t(`columnColor`), type: `Text`, optional }
    ],
    allowSelectBy: true
  });

  grist.onOptions((options) => {
    shared.config = normalizeConfig(options);
    app.setConfig(shared.config);
    link.send(`mapview:state`, { ...shared });
    pushConfig();
  });

  grist.onRecords((rows, mapping) => {
    const mapped = grist.mapColumnNames(rows);
    if (!mapped) {
      shared.message = t(`needColumns`);
      app.setDataMessage(shared.message);
      app.setData({ points: [], invalid: [], columns: shared.columns });
      link.send(`mapview:state`, { ...shared, points: [], invalid: [] });
      return;
    }
    const { points, invalid } = normalize(mapped);
    shared.points = points;
    shared.invalid = invalid;
    shared.columns = { lat: mapping.Latitude, lng: mapping.Longitude };
    shared.message = points.length || invalid.length ? `` : t(`noData`);
    app.setDataMessage(shared.message);
    app.setData({ points, invalid, columns: shared.columns });
    link.send(`mapview:state`, { ...shared });
  });

  // The selected row of the table: highlight its pin, here and in the window.
  grist.onRecord((record) => {
    shared.selectedId = record.id;
    app.select(record.id, true);
    link.send(`mapview:select`, { id: record.id });
  });

  grist.onNewRecord(() => {
    shared.selectedId = null;
    app.select(null);
    link.send(`mapview:select`, { id: null });
  });
})();
