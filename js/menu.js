// The map catalogue menu (button with a map icon), its "Other" dialog, the settings tab
// and the transparency slider. All text from the data or from the user is written with
// textContent, never as HTML.
(function () {
  const { t } = window.mapViewI18n;
  const catalog = window.mapViewCatalog;

  const MAX_RESULTS = 120;
  const MAX_NAME_LENGTH = 80;
  const MAX_TRANSPARENCY = 0.9;
  const SVG_NS = `http://www.w3.org/2000/svg`;

  // Small helper that builds an element: h(`div`, { class: `x`, text: `hello` }, child, child).
  function h(tag, props, ...children) {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (name === `text`) element.textContent = value;
      else if (name === `class`) element.className = value;
      else if (name.startsWith(`on`)) element.addEventListener(name.slice(2), value);
      else if (value === true) element.setAttribute(name, ``);
      else element.setAttribute(name, String(value));
    }
    for (const child of children.flat()) {
      if (child !== undefined && child !== null && child !== false) element.append(child);
    }
    return element;
  }

  // Inline SVG icon made of stroked paths (the paths are fixed texts written here).
  function icon(paths) {
    const svg = document.createElementNS(SVG_NS, `svg`);
    for (const [name, value] of Object.entries({
      width: 20, height: 20, viewBox: `0 0 24 24`, fill: `none`, stroke: `currentColor`,
      [`stroke-width`]: 2, [`stroke-linecap`]: `round`, [`stroke-linejoin`]: `round`, [`aria-hidden`]: `true`
    })) svg.setAttribute(name, String(value));
    for (const d of paths) {
      const path = document.createElementNS(SVG_NS, `path`);
      path.setAttribute(`d`, d);
      svg.appendChild(path);
    }
    return svg;
  }

  const ICON_MAP = [`M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z`, `M9 4v14`, `M15 6v14`];
  const ICON_EXPAND = [`M15 3h6v6`, `M9 21H3v-6`, `M21 3l-7 7`, `M3 21l7-7`];
  const ICON_DOCK = [`M14 10h6V4`, `M10 14H4v6`, `M20 4l-7 7`, `M4 20l7-7`];

  function newId() {
    return `custom:${window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
  }

  // ------------------------------------------------------------ Catalogue menu

  class CatalogMenu {
    // getConfig(): current settings. onChange(patch): called with the settings that changed.
    // options.onButton(): replaces the default behaviour of the button (open the panel here).
    // options.embedded: the panel fills its page (catalogue window): no button, always open.
    constructor(getConfig, onChange, options) {
      this.getConfig = getConfig;
      this.onChange = onChange;
      this.options = options || {};
      this.tab = `base`;
      this.query = ``;
      this.theme = ``;

      this.button = h(`button`, {
        type: `button`, class: `tool`, title: t(`openCatalog`), [`aria-label`]: t(`openCatalog`),
        [`aria-expanded`]: `false`,
        onclick: () => (this.options.onButton ? this.options.onButton() : this.toggle())
      }, icon(ICON_MAP));
      this.panel = h(`div`, {
        class: this.options.embedded ? `panel full` : `panel`, role: `dialog`,
        [`aria-label`]: t(`menuTitle`), hidden: !this.options.embedded
      });
      document.addEventListener(`keydown`, (event) => {
        if (event.key !== `Escape` || this.options.embedded) return;
        if (this.dialog) this.closeDialog();
        else if (!this.panel.hidden) this.toggle(false);
      });
    }

    toggle(open) {
      const show = open === undefined ? this.panel.hidden : open;
      this.panel.hidden = !show;
      this.button.setAttribute(`aria-expanded`, String(show));
      if (show) this.render();
    }

    // Draws the whole panel again (cheap: long lists are built only when opened).
    render() {
      if (this.panel.hidden) return;
      // Keep the scroll position of the list when the panel is drawn again.
      const list = this.panel.querySelector(`.list`);
      const scroll = list ? list.scrollTop : 0;
      this.panel.textContent = ``;
      const tabs = [[`base`, `tabBase`], [`overlay`, `tabOverlay`], [`settings`, `tabSettings`]];
      this.panel.append(
        h(`div`, { class: `panel-head` },
          h(`strong`, { text: t(`menuTitle`) }),
          h(`button`, { type: `button`, class: `plain`, title: t(`close`), [`aria-label`]: t(`close`), text: `×`, onclick: () => this.toggle(false) })),
        h(`div`, { class: `tabs`, role: `tablist` }, tabs.map(([id, key]) =>
          h(`button`, {
            type: `button`, role: `tab`, text: t(key), [`aria-selected`]: String(this.tab === id),
            onclick: () => { this.tab = id; this.render(); }
          })))
      );
      if (this.tab === `settings`) this.panel.append(this.settingsView());
      else this.panel.append(this.listView());
      const newList = this.panel.querySelector(`.list`);
      if (newList) newList.scrollTop = scroll;
    }

    // ---------------------------------------------------------------- List tabs

    listView() {
      const target = this.tab;
      const search = h(`input`, {
        type: `search`, placeholder: t(`searchPlaceholder`), value: this.query,
        [`aria-label`]: t(`searchPlaceholder`)
      });
      const theme = h(`select`, { [`aria-label`]: t(`themeAll`) },
        h(`option`, { value: ``, text: t(`themeAll`) }),
        catalog.THEMES.map((id) => h(`option`, { value: id, text: t(`theme_${id}`), selected: this.theme === id })));
      const body = h(`div`, { class: `list` });
      const refill = () => { body.textContent = ``; body.append(this.listBody(target)); };
      search.addEventListener(`input`, () => { this.query = search.value; refill(); });
      theme.addEventListener(`change`, () => { this.theme = theme.value; refill(); });
      refill();
      return h(`div`, { class: `list-view` },
        h(`div`, { class: `filters` }, search, theme),
        body,
        h(`div`, { class: `panel-foot` },
          h(`button`, { type: `button`, class: `action`, text: t(`other`), onclick: () => this.openDialog() })));
    }

    // Everything the list can show, as one flat array (user maps first).
    allEntries() {
      const custom = this.getConfig().customMaps.map((item) => catalog.customEntry(item));
      return [...custom, ...catalog.builtIn, ...catalog.ign];
    }

    listBody(target) {
      const fragment = document.createDocumentFragment();
      const query = this.query.trim().toLowerCase();

      // Search or theme filter: one flat list of results.
      if (query || this.theme) {
        const results = this.allEntries().filter((entry) =>
          (!this.theme || entry.theme === this.theme) &&
          (!query || `${entry.title} ${entry.source}`.toLowerCase().includes(query)));
        fragment.append(this.heading(t(`sectionResults`)));
        if (!results.length) fragment.append(h(`p`, { class: `empty`, text: t(`noResults`) }));
        results.slice(0, MAX_RESULTS).forEach((entry) => fragment.append(this.row(entry, target)));
        if (results.length > MAX_RESULTS) fragment.append(h(`p`, { class: `empty`, text: t(`moreResults`) }));
        return fragment;
      }

      if (target === `overlay`) fragment.append(this.noneRow());
      const custom = this.getConfig().customMaps.map((item) => catalog.customEntry(item));
      if (custom.length) {
        fragment.append(this.heading(t(`sectionCustom`)));
        custom.forEach((entry) => fragment.append(this.row(entry, target)));
      }
      fragment.append(this.heading(t(`sectionReference`)));
      catalog.reference.forEach((entry) => fragment.append(this.row(entry, target)));
      fragment.append(this.heading(t(`sectionBase`)));
      catalog.builtIn.forEach((entry) => fragment.append(this.row(entry, target)));
      fragment.append(this.heading(t(`sectionIgn`)));
      for (const theme of catalog.THEMES) {
        const entries = catalog.ign.filter((entry) => entry.theme === theme && !catalog.isReference(entry));
        if (!entries.length) continue;
        const details = h(`details`, { class: `theme` }, h(`summary`, { text: `${t(`theme_${theme}`)} (${entries.length})` }));
        // The rows of a theme are built the first time it is opened.
        details.addEventListener(`toggle`, () => {
          if (!details.open || details.dataset.filled) return;
          details.dataset.filled = `1`;
          entries.forEach((entry) => details.append(this.row(entry, target)));
        });
        fragment.append(details);
      }
      return fragment;
    }

    heading(text) {
      return h(`h3`, { class: `section`, text });
    }

    noneRow() {
      const radio = h(`input`, {
        type: `radio`, name: `pick-overlay`, checked: !this.getConfig().overlayId,
        onchange: () => this.onChange({ overlayId: null })
      });
      return h(`div`, { class: `row-wrap` },
        h(`label`, { class: `row` }, radio, h(`span`, { class: `thumb none`, text: `∅` }),
          h(`span`, { class: `row-text` }, h(`span`, { class: `row-title`, text: t(`noOverlay`) }))));
    }

    // One catalogue entry: radio, preview image or theme colour, title and source.
    row(entry, target) {
      const config = this.getConfig();
      const key = target === `base` ? `baseId` : `overlayId`;
      const radio = h(`input`, {
        type: `radio`, name: `pick-${target}`, checked: config[key] === entry.id,
        onchange: () => this.onChange({ [key]: entry.id })
      });

      let thumb = h(`span`, { class: `thumb theme-${entry.theme}`, [`aria-hidden`]: `true` });
      // Only the reference layers have a preview image, loaded when the menu is shown.
      if (entry.reference) {
        const image = h(`img`, { class: `thumb`, alt: ``, width: 56, height: 56, loading: `lazy`, src: catalog.thumbnailUrl(entry) });
        image.addEventListener(`error`, () => image.replaceWith(thumb));
        thumb = image;
      }

      const source = entry.isIgn ? t(`sourceIgn`) : (entry.custom ? `${t(`sourceCustom`)} · ${entry.source}` : entry.source);
      const needsKey = entry.needsKey && !entry.apiKey;
      const text = h(`span`, { class: `row-text` },
        h(`span`, { class: `row-title`, text: entry.title }),
        h(`span`, { class: `row-source`, text: source }),
        needsKey && h(`span`, { class: `row-badge`, text: t(`needsKeyBadge`) }));

      return h(`div`, { class: `row-wrap` },
        h(`label`, { class: `row` }, radio, thumb, text),
        entry.custom && h(`button`, {
          type: `button`, class: `plain`, title: t(`deleteMap`), [`aria-label`]: t(`deleteMap`), text: `×`,
          onclick: () => this.deleteCustom(entry.id)
        }));
    }

    deleteCustom(id) {
      const config = this.getConfig();
      const patch = { customMaps: config.customMaps.filter((item) => item.id !== id) };
      if (config.baseId === id) patch.baseId = null;
      if (config.overlayId === id) patch.overlayId = null;
      this.onChange(patch);
      this.render();
    }

    // ------------------------------------------------------------- Settings tab

    settingsView() {
      const config = this.getConfig();
      const zoomValue = h(`strong`, { text: String(config.defaultZoom) });
      const zoom = h(`input`, { type: `range`, min: 1, max: 20, value: config.defaultZoom, [`aria-label`]: t(`zoomMax`) });
      zoom.addEventListener(`input`, () => { zoomValue.textContent = zoom.value; });
      // The setting is saved when the slider is released, not at every step.
      zoom.addEventListener(`change`, () => this.onChange({ defaultZoom: Number(zoom.value) }));
      const popup = h(`input`, { type: `checkbox`, checked: config.showPopup });
      popup.addEventListener(`change`, () => this.onChange({ showPopup: popup.checked }));
      return h(`div`, { class: `settings` },
        h(`label`, { class: `setting` }, h(`span`, { text: t(`zoomMax`) }), h(`span`, { class: `slider` }, zoom, zoomValue)),
        h(`label`, { class: `setting check` }, popup, h(`span`, { text: t(`showPopup`) })),
        this.options.onResetView && h(`div`, { class: `setting` },
          h(`button`, { type: `button`, class: `action`, text: t(`resetView`), onclick: () => this.options.onResetView() }),
          h(`p`, { class: `note`, text: t(`resetViewNote`) })),
        h(`p`, { class: `note`, text: t(`privacyNote`) }));
    }

    // ------------------------------------------------------------ Other dialog

    openDialog() {
      const name = h(`input`, { type: `text`, maxlength: MAX_NAME_LENGTH, autocomplete: `off`, id: `f-name` });
      const url = h(`input`, { type: `text`, autocomplete: `off`, id: `f-url`, placeholder: `https://…/{z}/{x}/{y}.png` });
      const copyright = h(`input`, { type: `text`, autocomplete: `off`, id: `f-copyright` });
      const key = h(`input`, { type: `text`, autocomplete: `off`, id: `f-key` });
      const base = h(`input`, { type: `radio`, name: `f-kind`, value: `base`, checked: this.tab !== `overlay` });
      const overlay = h(`input`, { type: `radio`, name: `f-kind`, value: `overlay`, checked: this.tab === `overlay` });
      const errors = { name: h(`p`, { class: `error`, role: `alert` }), url: h(`p`, { class: `error`, role: `alert` }), key: h(`p`, { class: `error`, role: `alert` }) };

      const submit = () => {
        const problems = { name: ``, url: ``, key: `` };
        const nameText = name.value.trim();
        const urlText = url.value.trim();
        const keyText = key.value.trim();
        if (!nameText) problems.name = t(`errName`);
        const urlProblem = catalog.validateTileUrl(urlText);
        if (urlProblem) {
          problems.url = urlProblem.code === `placeholders` ? t(`errUrlPlaceholders`)
            : urlProblem.code === `other` ? t(`errUrlOther`, { name: urlProblem.name }) : t(`errUrl`);
        } else if (urlText.includes(`{apikey}`) && !keyText) {
          problems.key = t(`errKeyMissing`);
        } else if (keyText && !urlText.includes(`{apikey}`)) {
          problems.key = t(`errKeyUnused`);
        }
        for (const field of Object.keys(errors)) errors[field].textContent = problems[field];
        if (problems.name || problems.url || problems.key) return;

        const kind = overlay.checked ? `overlay` : `base`;
        const item = { id: newId(), name: nameText, url: urlText, copyright: copyright.value.trim(), key: keyText, kind };
        this.onChange({ customMaps: [...this.getConfig().customMaps, item] });
        this.closeDialog();
        this.tab = kind;
        this.render();
      };

      const field = (labelKey, input, help, error) => h(`div`, { class: `field` },
        h(`label`, { for: input.id, text: t(labelKey) }), input,
        help && h(`p`, { class: `note`, text: t(help) }), error);

      this.dialog = h(`div`, { class: `dialog-back` },
        h(`form`, { class: `dialog`, role: `dialog`, [`aria-label`]: t(`dialogTitle`), novalidate: true,
          onsubmit: (event) => { event.preventDefault(); submit(); } },
          h(`strong`, { text: t(`dialogTitle`) }),
          field(`fieldName`, name, null, errors.name),
          field(`fieldUrl`, url, `fieldUrlHelp`, errors.url),
          field(`fieldCopyright`, copyright, null, null),
          field(`fieldKey`, key, `fieldKeyHelp`, errors.key),
          h(`fieldset`, { class: `kind` }, h(`legend`, { text: t(`fieldType`) }),
            h(`label`, {}, base, ` ${t(`typeBase`)}`), h(`label`, {}, overlay, ` ${t(`typeOverlay`)}`)),
          h(`div`, { class: `buttons` },
            h(`button`, { type: `button`, class: `plain-text`, text: t(`cancel`), onclick: () => this.closeDialog() }),
            h(`button`, { type: `submit`, class: `action`, text: t(`create`) }))));
      this.panel.append(this.dialog);
      name.focus();
    }

    closeDialog() {
      if (this.dialog) this.dialog.remove();
      this.dialog = null;
    }
  }

  // -------------------------------------------------------- Transparency slider

  // Slider in the bottom-left corner. It acts on the overlay layer when one is shown,
  // otherwise on the base map.
  class TransparencyControl {
    // onLive(opacity, target): called while dragging. onCommit(opacity, target): called when
    // released. target is `overlay` or `base`.
    constructor(onLive, onCommit) {
      this.target = `base`;
      this.value = h(`span`, { class: `value` });
      this.input = h(`input`, { type: `range`, min: 0, max: Math.round(MAX_TRANSPARENCY * 100), step: 5, value: 0 });
      this.input.addEventListener(`input`, () => {
        this.showValue();
        onLive(this.opacity(), this.target);
      });
      this.input.addEventListener(`change`, () => onCommit(this.opacity(), this.target));
      this.element = h(`div`, { class: `transparency` }, h(`span`, { text: t(`transparency`) }), this.input, this.value);
    }

    opacity() {
      return Math.round((1 - Number(this.input.value) / 100) * 100) / 100;
    }

    showValue() {
      this.value.textContent = `${this.input.value} %`;
    }

    // target: `overlay` or `base`. opacity: the current opacity of that layer (0 to 1).
    update(target, opacity) {
      this.target = target;
      const title = t(target === `overlay` ? `transparencyTitle` : `transparencyBaseTitle`);
      this.input.title = title;
      this.input.setAttribute(`aria-label`, title);
      this.input.value = String(Math.round((1 - opacity) * 100));
      this.showValue();
    }
  }

  window.mapViewMenu = { CatalogMenu, TransparencyControl, h, icon, ICON_EXPAND, ICON_DOCK };
})();
