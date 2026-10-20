// The map screen shared by the Grist widget and the separate map window: the map, the
// catalogue menu, the transparency slider, the banner and the message shown in place of the map.
(function () {
  const { t } = window.mapViewI18n;
  const catalog = window.mapViewCatalog;
  const { CatalogMenu, TransparencyControl, h, icon, ICON_EXPAND, ICON_DOCK } = window.mapViewMenu;

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
    const opacity = Number(source.overlayOpacity);
    const zoom = Number(source.defaultZoom);
    return {
      baseId: known(source.baseId) || DEFAULT_BASE_ID,
      overlayId: known(source.overlayId),
      overlayOpacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0.1, opacity)) : DEFAULT_OPACITY,
      defaultZoom: Number.isFinite(zoom) ? Math.min(20, Math.max(1, Math.round(zoom))) : DEFAULT_ZOOM,
      showPopup: source.showPopup === undefined ? true : Boolean(source.showPopup),
      customMaps
    };
  }

  class MapApp {
    // host.onConfig(patch): a setting changed. host.onSelect(id): a pin was clicked.
    // host.onWindowButton(): the expand (Grist) or dock (window) button was clicked.
    constructor(host, mode) {
      this.host = host;
      this.mode = mode;
      this.config = normalizeConfig({});
      this.dataMessage = ``;
      this.invalidMessage = ``;
      this.wanted = { id: null, pending: false };
      this.docked = false;

      this.banner = document.getElementById(`banner`);
      this.status = document.getElementById(`docked`);
      const stage = document.getElementById(`stage`);
      const tools = document.getElementById(`tools`);

      this.engine = new window.MapEngine(document.getElementById(`map`), {
        onSelect: (id) => { this.wanted = { id, pending: false }; host.onSelect(id); }
      });
      this.menu = new CatalogMenu(() => this.config, (patch) => this.change(patch));
      this.slider = new TransparencyControl(
        (opacity) => this.engine.setOverlayOpacity(opacity),
        (opacity) => this.change({ overlayOpacity: opacity })
      );

      const windowButton = h(`button`, {
        type: `button`, class: `tool`,
        title: t(mode === `window` ? `dockWindow` : `openWindow`),
        [`aria-label`]: t(mode === `window` ? `dockWindow` : `openWindow`),
        onclick: () => host.onWindowButton()
      }, icon(mode === `window` ? ICON_DOCK : ICON_EXPAND));
      this.tools = tools;
      tools.append(this.menu.button, windowButton);
      stage.append(this.menu.panel, this.slider.element);
      this.applyConfig();
    }

    // A setting was changed by the user: apply it and tell the host to save it.
    change(patch) {
      Object.assign(this.config, patch);
      this.applyConfig();
      this.host.onConfig(patch);
    }

    // Applies a configuration received from outside (saved options, or the Grist widget).
    setConfig(config) {
      this.config = config;
      this.applyConfig();
    }

    applyConfig() {
      const { baseId, overlayId, overlayOpacity, defaultZoom, showPopup, customMaps } = this.config;
      const base = catalog.find(baseId, customMaps);
      const overlay = catalog.find(overlayId, customMaps);
      this.engine.setBase(base);
      this.engine.setOverlay(overlay, overlayOpacity);
      this.engine.setDefaultZoom(defaultZoom);
      this.engine.setShowPopup(showPopup);
      this.slider.update(Boolean(overlay), overlayOpacity);
      this.keyMessage = [base, overlay]
        .filter((entry) => entry && entry.needsKey && !entry.apiKey)
        .map((entry) => t(`needsApiKey`, { name: entry.title })).join(` `);
      this.menu.render();
      this.showBanner();
    }

    showBanner() {
      const text = [this.keyMessage, this.invalidMessage].filter(Boolean).join(` `);
      this.banner.textContent = text;
      this.banner.hidden = !text;
      this.engine.invalidateSize();
    }

    // points/invalid come from records.js; columns names the Latitude and Longitude columns.
    setData(data) {
      this.invalidMessage = window.mapViewRecords.describeInvalid(data.invalid, data.columns, t);
      this.showBanner();
      if (!this.docked) this.engine.setPoints(data.points);
      this.latestPoints = data.points;
      // A selection that arrived before its pin existed is applied now.
      if (this.wanted.pending) this.select(this.wanted.id, true);
    }

    // Highlights the pin of a row; with pan, the map moves to it and opens its label.
    select(id, pan) {
      this.wanted = { id, pending: false };
      if (id === null || id === undefined) {
        this.engine.clearSelection();
        return;
      }
      this.engine.select(id, { pan });
      if (pan && !this.engine.entries.has(id)) this.wanted = { id, pending: true };
    }

    // Replaces the map by a message (no data, missing columns, map in another window).
    // dockButton adds the "put the map back" button under the message.
    showMessage(text, dockButton) {
      this.status.textContent = ``;
      this.status.hidden = !text;
      if (!text) return;
      this.status.append(h(`p`, { text }));
      if (dockButton) {
        this.status.append(h(`button`, { type: `button`, class: `action`, text: t(`dockButton`), onclick: () => this.host.onWindowButton() }));
      }
    }

    // The Grist widget hides its map while the separate window shows it.
    setDocked(docked) {
      this.docked = docked;
      this.tools.hidden = docked;
      if (docked) {
        this.menu.toggle(false);
        this.showMessage(t(`dockedMessage`), true);
        return;
      }
      this.showMessage(this.dataMessage, false);
      this.engine.invalidateSize();
      if (this.latestPoints) this.engine.setPoints(this.latestPoints);
      if (this.wanted.id !== null) this.select(this.wanted.id, true);
    }

    // Message that replaces the map when there is nothing to draw (empty string to clear it).
    setDataMessage(text) {
      this.dataMessage = text;
      if (!this.docked) this.showMessage(text, false);
    }
  }

  window.MapApp = MapApp;
  window.mapViewConfig = { normalizeConfig };
})();
