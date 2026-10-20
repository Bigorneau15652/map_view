// The map itself. It is created once and then updated in place: switching the base map,
// moving the transparency slider or editing one row never rebuilds the whole map.
(function () {
  const { pinIcon, resolve } = window.mapViewColors;
  const { tileUrl } = window.mapViewCatalog;

  const MAX_ZOOM = 20;
  const CLUSTER_RADIUS = 30;
  const NO_CLUSTER_ZOOM = 18;
  const FIT_PADDING = [30, 30];
  const FIT_MAX_ZOOM = 13;
  const SELECTED_Z_OFFSET = 1000;
  const FRANCE_CENTER = [46.6, 2.4];
  const FRANCE_ZOOM = 5;
  const VIEW_SAVE_DELAY_MS = 300;

  class MapEngine {
    // container: the element that receives the map.
    // handlers.onSelect(id): called when the user clicks a pin.
    constructor(container, handlers) {
      this.handlers = handlers || {};
      this.entries = new Map();      // row id -> { marker, signature, point }
      this.selectedId = null;
      this.baseLayer = null;
      this.overlayLayer = null;
      this.baseKey = ``;
      this.overlayKey = ``;
      this.pendingView = null;       // saved view to restore when the first pins arrive
      this.hasFitted = false;        // the map is fitted on the pins only once, at the start
      this.suppressPan = false;      // the first selection must not move a restored view
      this.viewReady = false;        // true once the first view (saved or fitted) is in place
      this.viewTimer = null;

      this.map = L.map(container, { zoomControl: false, wheelPxPerZoomLevel: 90, maxZoom: MAX_ZOOM });
      this.map.setView(FRANCE_CENTER, FRANCE_ZOOM);
      // Overlay tiles sit above the base tiles and below the markers.
      this.map.createPane(`overlayTiles`).style.zIndex = 250;

      this.cluster = L.markerClusterGroup({
        chunkedLoading: true,
        disableClusteringAtZoom: NO_CLUSTER_ZOOM,
        maxClusterRadius: CLUSTER_RADIUS,
        showCoverageOnHover: false,
        iconCreateFunction: (cluster) => this._clusterIcon(cluster)
      });
      this.cluster.on(`click`, (event) => {
        const id = event.layer.options.rowId;
        this.select(id, { pan: false });
        if (this.handlers.onSelect) this.handlers.onSelect(id);
      });
      this.map.addLayer(this.cluster);

      // Every change of the view (centre and zoom) is reported, so that the saved view is always
      // the one shown on the map. Nothing is reported before the first view is in place.
      this.map.on(`moveend`, () => this._reportView());
      this.map.on(`zoomend`, () => {
        if (this.handlers.onZoom) this.handlers.onZoom(this.map.getZoom());
      });
      // A pending save is written at once when the page is closed or hidden.
      window.addEventListener(`pagehide`, () => this._flushView());

      // The accent colour of a label follows the colour of its pin.
      this.map.on(`popupopen`, (event) => {
        const marker = event.popup._source;
        if (!marker || marker.options.rowId === undefined) return;
        const entry = this.entries.get(marker.options.rowId);
        const element = event.popup.getElement();
        if (entry && element) element.style.setProperty(`--accent`, resolve(entry.point.color));
      });
    }

    // ----------------------------------------------------------------- Layers

    _makeTileLayer(entry, pane, opacity) {
      return L.tileLayer(tileUrl(entry), {
        attribution: entry.attribution,
        minZoom: entry.minZoom,
        maxNativeZoom: entry.maxNativeZoom,
        maxZoom: MAX_ZOOM,
        subdomains: entry.subdomains || `abc`,
        pane,
        opacity,
        keepBuffer: 1
      });
    }

    // Shows a base map (or none when the entry is null or lacks its key). The same map is
    // not loaded twice: only its opacity is updated.
    setBase(entry, opacity) {
      const wanted = this._layerKey(entry);
      if (this.baseLayer && wanted === this.baseKey) {
        this.baseLayer.setOpacity(opacity === undefined ? 1 : opacity);
        return;
      }
      if (this.baseLayer) this.map.removeLayer(this.baseLayer);
      this.baseLayer = null;
      this.baseKey = wanted;
      if (!wanted) return;
      this.baseLayer = this._makeTileLayer(entry, `tilePane`, opacity === undefined ? 1 : opacity).addTo(this.map);
    }

    // Shows an overlay layer above the base map with the given opacity (0 to 1).
    setOverlay(entry, opacity) {
      const wanted = this._layerKey(entry);
      if (this.overlayLayer && wanted === this.overlayKey) {
        this.overlayLayer.setOpacity(opacity);
        return;
      }
      if (this.overlayLayer) this.map.removeLayer(this.overlayLayer);
      this.overlayLayer = null;
      this.overlayKey = wanted;
      if (!wanted) return;
      this.overlayLayer = this._makeTileLayer(entry, `overlayTiles`, opacity).addTo(this.map);
    }

    // Identifies what a layer shows (its tile address); empty when there is nothing to show.
    _layerKey(entry) {
      return !entry || (entry.needsKey && !entry.apiKey) ? `` : tileUrl(entry);
    }

    setBaseOpacity(opacity) {
      if (this.baseLayer) this.baseLayer.setOpacity(opacity);
    }

    setOverlayOpacity(opacity) {
      if (this.overlayLayer) this.overlayLayer.setOpacity(opacity);
    }

    // ------------------------------------------------------------------- View

    // Zoom chosen with the zoom slider.
    setZoom(zoom) {
      this.map.setZoom(zoom);
    }

    // The view saved at the last visit: it replaces the automatic fit when the pins arrive.
    restoreView(view) {
      this.pendingView = view;
    }

    _reportView() {
      if (!this.handlers.onViewChange || !this.viewReady) return;
      clearTimeout(this.viewTimer);
      this.viewTimer = setTimeout(() => this._flushView(), VIEW_SAVE_DELAY_MS);
    }

    _flushView() {
      if (!this.handlers.onViewChange || !this.viewReady) return;
      clearTimeout(this.viewTimer);
      const center = this.map.getCenter();
      this.handlers.onViewChange({ lat: center.lat, lng: center.lng, zoom: this.map.getZoom() });
    }

    // ------------------------------------------------------------------ Size

    invalidateSize() {
      this.map.invalidateSize();
    }

    // ------------------------------------------------------------------ Points

    // Brings the pins in line with the given points, touching only what changed.
    setPoints(points) {
      const wanted = new Map(points.map((p) => [p.id, p]));
      const toAdd = [];
      const toRemove = [];

      for (const [id, entry] of this.entries) {
        if (!wanted.has(id)) {
          toRemove.push(entry.marker);
          this.entries.delete(id);
        }
      }
      for (const point of points) {
        const signature = `${point.lat}|${point.lng}|${point.name}|${point.description}|${point.color}`;
        const entry = this.entries.get(point.id);
        if (!entry) {
          const marker = this._makeMarker(point);
          this.entries.set(point.id, { marker, signature, point });
          toAdd.push(marker);
        } else if (entry.signature !== signature) {
          entry.marker.setLatLng([point.lat, point.lng]);
          // The title is read again when the icon is rebuilt.
          entry.marker.options.title = point.name;
          entry.marker.setIcon(pinIcon(resolve(point.color), point.id === this.selectedId));
          entry.signature = signature;
          entry.point = point;
        }
      }

      if (toRemove.length) this.cluster.removeLayers(toRemove);
      if (toAdd.length) this.cluster.addLayers(toAdd);
      // The view is set once, when the first pins appear (saved view, or fit on all the pins).
      // After that it only moves when the user moves it or when a row is selected: a table
      // linked to another one replaces its rows at every selection, which must not change zoom.
      if (!this.hasFitted && this.entries.size) {
        this.hasFitted = true;
        if (this.pendingView) {
          const { lat, lng, zoom } = this.pendingView;
          this.map.setView([lat, lng], zoom, { animate: false });
          this.pendingView = null;
          this.suppressPan = true;
        } else {
          this._fit();
        }
        // Moves made by the first positioning are not saved; later ones are.
        setTimeout(() => { this.viewReady = true; }, 0);
      }
    }

    _makeMarker(point) {
      const marker = L.marker([point.lat, point.lng], {
        title: point.name,
        rowId: point.id,
        icon: pinIcon(resolve(point.color), point.id === this.selectedId)
      });
      // The label is built only when it opens, so thousands of pins stay light.
      marker.bindPopup(() => this._popupContent(point.id), { className: `map-popup` });
      return marker;
    }

    // Label content built from text nodes only: table data is never read as HTML.
    _popupContent(id) {
      const entry = this.entries.get(id);
      const root = document.createElement(`div`);
      if (!entry) return root;
      const title = document.createElement(`div`);
      title.className = `popup-title`;
      title.textContent = entry.point.name;
      root.appendChild(title);
      if (entry.point.description) {
        const description = document.createElement(`div`);
        description.className = `popup-desc`;
        // Both a real line break and the two characters \n start a new line.
        const lines = entry.point.description.split(/\r?\n|\\n/);
        lines.forEach((line, index) => {
          if (index > 0) description.appendChild(document.createElement(`br`));
          description.appendChild(document.createTextNode(line));
        });
        root.appendChild(description);
      }
      return root;
    }

    _fit() {
      const bounds = L.latLngBounds([...this.entries.values()].map((e) => e.marker.getLatLng()));
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { maxZoom: FIT_MAX_ZOOM, padding: FIT_PADDING, animate: false });
      }
    }

    // --------------------------------------------------------------- Selection

    _clusterIcon(cluster) {
      const count = cluster.getChildCount();
      const size = count < 10 ? `small` : count < 100 ? `medium` : `large`;
      const selected = this.selectedId !== null &&
        cluster.getAllChildMarkers().some((m) => m.options.rowId === this.selectedId);
      const content = document.createElement(`div`);
      const label = document.createElement(`span`);
      label.textContent = String(count);
      content.appendChild(label);
      return L.divIcon({
        html: content.outerHTML,
        className: `marker-cluster marker-cluster-${size}${selected ? ` marker-cluster-selected` : ``}`,
        iconSize: new L.Point(40, 40)
      });
    }

    _setSelectedLook(id, selected) {
      const entry = this.entries.get(id);
      if (!entry) return null;
      entry.marker.setIcon(pinIcon(resolve(entry.point.color), selected));
      entry.marker.setZIndexOffset(selected ? SELECTED_Z_OFFSET : 0);
      return entry.marker;
    }

    // Highlights the pin of a row. With pan, the map moves to it and opens its label.
    select(id, options) {
      const previous = this._setSelectedLook(this.selectedId, false);
      this.selectedId = id === undefined ? null : id;
      const marker = this._setSelectedLook(this.selectedId, true);
      // Only the clusters holding these two pins need a new icon.
      const touched = [previous, marker].filter(Boolean);
      if (touched.length) this.cluster.refreshClusters(touched);
      if (!marker || !(options && options.pan)) return;
      // The first selection after a restored view leaves the map alone when the pin is in view.
      if (this.suppressPan) {
        this.suppressPan = false;
        if (this.map.getBounds().contains(marker.getLatLng())) return;
      }

      // The zoom chosen by the user is kept. A pin hidden inside a cluster is only centred
      // (its cluster is highlighted); its label opens when the pin is visible.
      this.map.panTo(marker.getLatLng());
      if (marker._icon) {
        marker.openPopup();
        return;
      }
      // A pin outside the view is drawn once the map has moved; its label then opens, unless
      // another row was selected in the meantime or the pin is still inside a cluster.
      this.map.once(`moveend`, () => setTimeout(() => {
        if (this.selectedId === id && marker._icon) marker.openPopup();
      }, 0));
    }

    clearSelection() {
      this.select(null);
      this.map.closePopup();
    }
  }

  window.MapEngine = MapEngine;
})();
