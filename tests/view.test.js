// Tests of the saved view of the map: what is read from the options of the widget and how it is rounded.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { readSavedView, roundView } = require(`../js/view.js`);

test(`a saved view is read from the options`, () => {
  assert.deepEqual(readSavedView({ view: { lat: 43.6, lng: 3.87, zoom: 12 } }), { lat: 43.6, lng: 3.87, zoom: 12 });
  assert.deepEqual(readSavedView({ view: { lat: -90, lng: 180, zoom: 0 } }), { lat: -90, lng: 180, zoom: 0 });
});

test(`a missing or damaged view gives null`, () => {
  assert.equal(readSavedView(null), null);
  assert.equal(readSavedView({}), null);
  assert.equal(readSavedView({ view: `12` }), null);
  assert.equal(readSavedView({ view: { lat: `43`, lng: 3, zoom: 12 } }), null);
  assert.equal(readSavedView({ view: { lat: 43, lng: 3 } }), null);
  assert.equal(readSavedView({ view: { lat: NaN, lng: 3, zoom: 5 } }), null);
  assert.equal(readSavedView({ view: { lat: 91, lng: 3, zoom: 5 } }), null);
  assert.equal(readSavedView({ view: { lat: 43, lng: 181, zoom: 5 } }), null);
  assert.equal(readSavedView({ view: { lat: 43, lng: 3, zoom: 21 } }), null);
  assert.equal(readSavedView({ view: { lat: 43, lng: 3, zoom: -1 } }), null);
});

test(`a view is rounded before it is written`, () => {
  assert.deepEqual(roundView({ lat: 43.123456789, lng: 3.987654321, zoom: 11.6 }), { lat: 43.12346, lng: 3.98765, zoom: 12 });
  assert.deepEqual(roundView({ lat: 43.5, lng: 3, zoom: 7 }), { lat: 43.5, lng: 3, zoom: 7 });
});
