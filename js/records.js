// Turns the rows given by Grist into clean points for the map.
// Nothing here touches the page: invalid rows are reported, never thrown.
(function () {
  const MAX_NAME_LENGTH = 300;
  const MAX_DESCRIPTION_LENGTH = 5000;
  const MAX_EXAMPLES = 3;

  // Grist sometimes wraps a value as V(...) for reference columns; this reads it safely.
  function parseValue(value) {
    if (value && typeof value === `object` && typeof value.value === `string` && value.value.startsWith(`V(`)) {
      try {
        const parsed = JSON.parse(value.value.slice(2, -1));
        return parsed.remote || parsed.local || parsed.parent || parsed;
      } catch {
        return ``;
      }
    }
    return value;
  }

  function toText(value, maxLength) {
    const parsed = parseValue(value);
    if (parsed === null || parsed === undefined) return ``;
    return String(typeof parsed === `object` ? `` : parsed).slice(0, maxLength);
  }

  // A number inside the valid range, or null.
  function toCoordinate(value, limit) {
    const parsed = parseValue(value);
    if (parsed === null || parsed === undefined || parsed === ``) return null;
    const number = typeof parsed === `number` ? parsed : Number(parsed);
    return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
  }

  // rows: records with the mapped column names Name, Longitude, Latitude, Description, Color.
  // Returns { points, invalid } where invalid lists { id, label } of the ignored rows.
  function normalize(rows) {
    const points = [];
    const invalid = [];
    for (const row of rows) {
      const lat = toCoordinate(row.Latitude, 90);
      const lng = toCoordinate(row.Longitude, 180);
      const name = toText(row.Name, MAX_NAME_LENGTH);
      const rawLat = parseValue(row.Latitude);
      const rawLng = parseValue(row.Longitude);
      const empty = (v) => v === null || v === undefined || v === `` || v === 0;
      // A row without coordinates (empty or 0 / 0) is a blank row: nothing to report.
      if (empty(rawLat) && empty(rawLng)) continue;
      if (lat === null || lng === null) {
        invalid.push({ id: row.id, label: name || `#${row.id}` });
        continue;
      }
      points.push({
        id: row.id, name, lat, lng,
        description: toText(row.Description, MAX_DESCRIPTION_LENGTH),
        color: toText(row.Color, 40)
      });
    }
    return { points, invalid };
  }

  // Text of the data-quality banner: which columns to check, how many rows, a few examples.
  function describeInvalid(invalid, columns, t) {
    if (!invalid.length) return ``;
    const shown = invalid.slice(0, MAX_EXAMPLES).map((item) => item.label).join(` ; `);
    const rest = invalid.length - MAX_EXAMPLES;
    return t(`rowsIgnored`, {
      count: invalid.length, lat: columns.lat, lng: columns.lng,
      examples: rest > 0 ? t(`andOthers`, { examples: shown, rest }) : shown
    });
  }

  window.mapViewRecords = { normalize, describeInvalid };
})();
