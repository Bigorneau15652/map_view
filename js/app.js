// The map screen shared by the Grist widget and the separate map window: the map, the
// catalogue menu, the transparency slider, the banner and the message shown in place of the map.
(function () {
  const { t } = window.mapViewI18n;
  const catalog = window.mapViewCatalog;
  const { normalizeConfig } = window.mapViewConfig;
  const { CatalogMenu, TransparencyControl, h, icon, ICON_EXPAND, ICON_DOCK } = window.mapViewMenu;

  // Below this size of the map area, the catalogue opens in a separate window.
  const SMALL_STAGE_HEIGHT = 560;
  const SMALL_STAGE_WIDTH = 460;

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
      // In a small widget the catalogue opens in its own window; otherwise it opens in place.
      this.menu = new CatalogMenu(() => this.config, (patch) => this.change(patch), {
        onButton: () => {
          const small = stage.clientHeight < SMALL_STAGE_HEIGHT || stage.clientWidth < SMALL_STAGE_WIDTH;
          if (small && host.onCatalogWindow && host.onCatalogWindow()) return;
          this.menu.toggle();
        }
      });
      // The slider acts on the overlay layer when there is one, otherwise on the base map.
      this.slider = new TransparencyControl(
        (opacity, target) => (target === `overlay` ? this.engine.setOverlayOpacity(opacity) : this.engine.setBaseOpacity(opacity)),
        (opacity, target) => this.change(target === `overlay` ? { overlayOpacity: opacity } : { baseOpacity: opacity })
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
    // The menu already shows the choice, so it is not drawn again.
    change(patch) {
      Object.assign(this.config, patch);
      this.applyConfig(false);
      this.host.onConfig(patch);
    }

    // Applies a configuration received from outside (saved options, or the Grist widget).
    setConfig(config) {
      this.config = config;
      this.applyConfig();
    }

    applyConfig(redrawMenu = true) {
      const { baseId, overlayId, overlayOpacity, baseOpacity, defaultZoom, showPopup, customMaps } = this.config;
      const base = catalog.find(baseId, customMaps);
      const overlay = catalog.find(overlayId, customMaps);
      this.engine.setBase(base, baseOpacity);
      this.engine.setOverlay(overlay, overlayOpacity);
      this.engine.setDefaultZoom(defaultZoom);
      this.engine.setShowPopup(showPopup);
      this.slider.update(overlay ? `overlay` : `base`, overlay ? overlayOpacity : baseOpacity);
      this.keyMessage = [base, overlay]
        .filter((entry) => entry && entry.needsKey && !entry.apiKey)
        .map((entry) => t(`needsApiKey`, { name: entry.title })).join(` `);
      if (redrawMenu) this.menu.render();
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
})();
