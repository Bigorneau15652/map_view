// Browser test of the saved view: the widget runs in Chromium with a fake Grist object that keeps the options, and the
// browser storage is blocked as it can be inside the frame of a widget. The zoom set with the slider or with
// Ctrl and the wheel must be saved in the options, kept when the row changes and found again at the next visit.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const http = require(`node:http`);
const fs = require(`node:fs`);
const path = require(`node:path`);
const { chromium } = require(`playwright`);

const ROOT = path.resolve(__dirname, `..`, `..`);
const TYPES = new Map([[`.html`, `text/html`], [`.js`, `text/javascript`], [`.css`, `text/css`]]);
const ROWS = [
  { id: 1, Name: `A`, Latitude: 43.61, Longitude: 3.87 },
  { id: 2, Name: `B`, Latitude: 43.62, Longitude: 3.9 },
  { id: 3, Name: `C`, Latitude: 43.35, Longitude: 3.25 }
];

// Serves the files of the repository on a free port. Resolves to { url, close }.
function startServer() {
  const server = http.createServer((request, response) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(request.url, `http://x`).pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { [`content-type`]: TYPES.get(path.extname(file)) || `application/octet-stream` });
    response.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, `127.0.0.1`, () => resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }));
  });
}

// The fake grist object, as the text of a script. `saved` holds the options of the document at the start.
function fakeGrist(saved) {
  return `
const rows = ${JSON.stringify(ROWS)};
const options = ${JSON.stringify(saved)};
let notify = null;
window.grist = {
  ready() {},
  onOptions(callback) { notify = callback; setTimeout(() => callback(options, {}), 0); },
  setOption(name, value) { options[name] = value; window.__persist(name, value); setTimeout(() => notify(options, {}), 5); return Promise.resolve(); },
  selectedTable: { getTableId: async () => \`Table\` },
  docApi: { getDocName: async () => \`Doc\` },
  mapColumnNames: (records) => records,
  setCursorPos: async () => {},
  onRecords(callback) { setTimeout(() => callback(rows, { Latitude: \`Latitude\`, Longitude: \`Longitude\` }), 20); },
  onRecord(callback) { window.__onRecord = callback; setTimeout(() => callback({ id: 1 }), 60); },
  onNewRecord() {}
};`;
}

let server;
let browser;
test.before(async () => {
  server = await startServer();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
});
test.after(async () => {
  await browser.close();
  server.close();
});

// Opens the widget like a new visit: a new browser profile, with the options saved so far in `store`.
async function visit(store) {
  const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const page = await context.newPage();
  const errors = [];
  page.on(`pageerror`, (error) => errors.push(String(error)));
  await page.addInitScript(() => {
    Object.defineProperty(window, `localStorage`, { get() { throw new Error(`blocked`); } });
  });
  await page.exposeFunction(`__persist`, (name, value) => { store[name] = value; });
  await page.route(`**/grist-plugin-api.js`, (route) => route.fulfill({ body: fakeGrist(store), contentType: `text/javascript` }));
  await page.route(/^https:\/\/(?!grist).*/, (route) => route.abort());
  await page.goto(`${server.url}/index.html`);
  await page.waitForFunction(() => typeof window.__onRecord === `function`);
  await page.waitForTimeout(600);
  const zoom = () => page.evaluate(() => Number(document.querySelector(`.zoom-slider input`).value));
  return { context, page, errors, zoom };
}

test(`the zoom of the slider is saved in the options, kept when the row changes and found again at the next visit`, async () => {
  const store = {};
  const first = await visit(store);
  await first.page.evaluate(() => {
    const input = document.querySelector(`.zoom-slider input`);
    input.value = `14`;
    input.dispatchEvent(new Event(`input`, { bubbles: true }));
  });
  await first.page.waitForTimeout(1300);
  assert.equal(store.view.zoom, 14);
  await first.page.evaluate(() => window.__onRecord({ id: 3 }));
  await first.page.waitForTimeout(600);
  assert.equal(await first.zoom(), 14);
  await first.page.waitForTimeout(1200);
  assert.equal(store.view.zoom, 14);
  assert.deepEqual(first.errors, []);
  await first.context.close();

  const second = await visit(store);
  assert.equal(await second.zoom(), 14);
  assert.deepEqual(second.errors, []);
  await second.context.close();
});

test(`Ctrl and the wheel zoom the map and the zoom is saved`, async () => {
  const store = {};
  const first = await visit(store);
  const before = await first.zoom();
  const box = await first.page.locator(`#map`).boundingBox();
  await first.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await first.page.keyboard.down(`Control`);
  await first.page.mouse.wheel(0, -300);
  await first.page.keyboard.up(`Control`);
  await first.page.waitForTimeout(1300);
  const after = await first.zoom();
  assert.ok(after > before, `zoom ${before} then ${after}`);
  assert.equal(store.view.zoom, after);
  await first.context.close();
  const second = await visit(store);
  assert.equal(await second.zoom(), after);
  await second.context.close();
});

test(`a damaged saved view is ignored and the map opens fitted on the pins`, async () => {
  const store = { view: { lat: `x`, lng: 3, zoom: 99 } };
  const first = await visit(store);
  const zoom = await first.zoom();
  assert.ok(zoom >= 5 && zoom <= 13, `zoom ${zoom}`);
  assert.deepEqual(first.errors, []);
  await first.context.close();
});

test(`the label of the selected pin opens at the start, also when a saved view is restored, and the map does not move`, async () => {
  const store = { view: { lat: 43.6, lng: 3.88, zoom: 13 } };
  const first = await visit(store);
  assert.equal(await first.page.locator(`.leaflet-popup`).count(), 1);
  assert.match(await first.page.locator(`.leaflet-popup .popup-title`).innerText(), /A/);
  assert.equal(await first.zoom(), 13);
  assert.deepEqual(first.errors, []);
  await first.context.close();
});

test(`the label also opens when the widget was hidden at the start and is shown afterwards`, async () => {
  const store = { view: { lat: 43.6, lng: 3.88, zoom: 13 } };
  const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const page = await context.newPage();
  await page.exposeFunction(`__persist`, (name, value) => { store[name] = value; });
  await page.route(`**/grist-plugin-api.js`, (route) => route.fulfill({ body: fakeGrist(store), contentType: `text/javascript` }));
  await page.route(/^https:\/\/(?!grist).*/, (route) => route.abort());
  // The widget of a section that is folded in Grist: its frame has no size until the section is opened.
  await page.setContent(`<iframe id="widget" src="${server.url}/index.html" style="display:none"></iframe>`);
  await page.waitForTimeout(1200);
  await page.evaluate(() => { document.getElementById(`widget`).style.cssText = `display:block;width:880px;height:680px;border:0`; });
  await page.waitForTimeout(1500);
  const frame = page.frames().find((item) => item.url().includes(`index.html`));
  assert.equal(await frame.locator(`.leaflet-popup`).count(), 1);
  await context.close();
});
