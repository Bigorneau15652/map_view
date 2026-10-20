// The map itself. It is created once and then updated in place: switching the base map,
// moving the transparency slider or editing one row never rebuilds the whole map.
(function () {
  const { pinIcon, resolve } = window.mapViewColors;
  const { tileUrl } = window.mapViewCatalog;

  const MAX_ZOOM = 20;
  const CLUSTER_RADIUS = 30;
  const NO_CLUSTER_ZOOM = 18;
  const FIT_PADDING = [30, 30];
  const SELECTED_Z_OFFSET = 1000;
  const FRANCE_CENTER = [46.6, 2.4];
  const FRANCE_ZOOM = 5;

  class MapEngine {
    // container: the element that receives the map.
    // handlers.onSelect(id): called when the user clicks a pin.
    constructor(container, handlers) {
      this.handlers = handlers || {};
      this.entries = new Map();      // row id -> { marker, signature, point }
      this.selectedId = null;
      this.defaultZoom = 13;
      this.showPopup = true;
      this.baseLayer = null;
      this.overlayLayer = null;

      this.map = L.map(container, { wheelPxPerZoomLevel: 90, maxZoom: MAX_ZOOM });
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

    // Shows a base map (or none when the entry is null or lacks its key).
    setBase(entry, opacity) {
      if (this.baseLayer) this.map.removeLayer(this.baseLayer);
      this.baseLayer = null;
      if (!entry || (entry.needsKey && !entry.apiKey)) return;
      this.baseLayer = this._makeTileLayer(entry, `tilePane`, opacity === undefined ? 1 : opacity).addTo(this.map);
    }

    // Shows an overlay layer above the base map with the given opacity (0 to 1).
    setOverlay(entry, opacity) {
      if (this.overlayLayer) this.map.removeLayer(this.overlayLayer);
      this.overlayLayer = null;
      if (!entry || (entry.needsKey && !entry.apiKey)) return;
      this.overlayLayer = this._makeTileLayer(entry, `overlayTiles`, opacity).addTo(this.map);
    }

    setBaseOpacity(opacity) {
      if (this.baseLayer) this.baseLayer.setOpacity(opacity);
    }

    setOverlayOpacity(opacity) {
      if (this.overlayLayer) this.overlayLayer.setOpacity(opacity);
    }

    // ---------------------------------------------------------------- Settings

    setDefaultZoom(zoom) {
      this.defaultZoom = zoom;
    }

    setShowPopup(show) {
      this.showPopup = show;
      if (!show) this.map.closePopup();
    }

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
      // The view only moves when pins appear or disappear, not when a cell is edited.
      if ((toAdd.length || toRemove.length) && this.entries.size) this._fit();
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
        this.map.fitBounds(bounds, { maxZoom: this.defaultZoom, padding: FIT_PADDING, animate: false });
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

      const show = () => {
        this.map.panTo(marker.getLatLng());
        if (this.showPopup) marker.openPopup();
      };
      // A pin hidden inside a cluster needs the map to zoom in on it first.
      if (marker._icon) show();
      else this.cluster.zoomToShowLayer(marker, show);
    }

    clearSelection() {
      this.select(null);
      this.map.closePopup();
    }
  }

  window.MapEngine = MapEngine;
})();
