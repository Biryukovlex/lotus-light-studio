// Frontend interaction contracts; Node's built-in runner, no browser dependencies.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('lotus_lamp/web/app.js', 'utf8');
const html = fs.readFileSync('lotus_lamp/web/index.html', 'utf8');
const modeNames = JSON.parse(fs.readFileSync('lotus_lamp/data/mode_names.json', 'utf8'));
const categories = JSON.parse(fs.readFileSync('lotus_lamp/data/mode_categories.json', 'utf8'));
const fullCatalog = Object.entries(modeNames).map(([id, name]) => ({
  id: Number(id), name, category: Object.keys(categories).find(key => categories[key].includes(Number(id))),
}));
const tick = () => new Promise(resolve => setImmediate(resolve));

async function app({connected = true, values = {}, animations = false, reducedMotion = false,
  capture = null, savedPresets = [], catalog = [{id: 0, name: 'Auto Play', category: 'basic'}], signalrgb} = {}) {
  const elements = new Map();
  const frames = [];
  class Element {
    constructor() {
      this.value = ''; this.children = []; this.attrs = {}; this.textContent = ''; this.style = {};
      this.classList = { toggle() {} };
    }
    setAttribute(key, value) { this.attrs[key] = value; }
    removeAttribute(key) { delete this.attrs[key]; }
    focus() { this.focused = true; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    replaceChildren() { this.children = []; }
    append(...children) {
      this.children.push(...children);
      if (!this.value && children[0]?.value !== undefined) this.value = String(children[0].value);
    }
    get options() { return this.children; }
  }
  if (animations) {
    Element.prototype.getContext = () => ({clearRect() {}, fillRect() {}});
    Element.prototype.getBoundingClientRect = () => ({top: 0, bottom: 60});
  }
  for (const [, id] of html.matchAll(/id="([\w-]+)"/g)) elements.set(id, new Element());
  for (const [id, value] of [['brightness', '75'], ['effect-speed', '25'], ['solid', '#82cba8'], ['capture-speed', '25']])
    elements.get(id).value = value;
  const status = {connected, device: {name: 'Test lamp'}, saved: {name: 'Test lamp', address: 'test'}, values, capture, signalrgb};
  const requests = [];
  let commandResponse;
  const context = vm.createContext({
    document: {
      getElementById(id) { assert.ok(elements.has(id), `Missing element: ${id}`); return elements.get(id); },
      querySelectorAll() { return []; },
      createElement() { return new Element(); },
    },
    setInterval() {},
    requestAnimationFrame: callback => frames.push(callback),
    window: {innerHeight: 800, matchMedia: () => ({matches: reducedMotion})},
    fetch: async (path, options) => {
      if (path === '/api/status') return {ok: true, json: async () => structuredClone(status)};
      if (path === '/api/modes') return {ok: true, json: async () => catalog};
      if (path === '/api/presets') return {ok: true, json: async () => ({presets: savedPresets})};
      requests.push({path, ...options, body: JSON.parse(options.body)});
      if (commandResponse) return commandResponse();
      const data = JSON.parse(options.body);
      status.values[data.action] = data.value;
      if (data.action === 'hold' && !data.value) status.values.speed = data.resume_speed;
      return {ok: true, json: async () => structuredClone(status)};
    },
  });
  vm.runInContext(source, context);
  await tick();
  return {elements, status, requests, frame: time => frames.shift()(time),
    evaluate: expression => vm.runInContext(expression, context),
    respondWith: fn => { commandResponse = fn; }};
}

test('one Pause/Resume control uses hold 128 path and preserves resume speed zero', async () => {
  const ui = await app({values: {speed: 0}});
  const button = ui.elements.get('toggle-playback');
  assert.equal(button.attrs['aria-label'], 'Pause animation');
  assert.equal(ui.elements.get('effect-speed').value, 0);
  button.onclick(); await tick();
  assert.deepEqual(ui.requests[0].body, {action: 'hold', value: true});
  assert.equal(button.attrs['aria-label'], 'Resume animation');
  assert.equal(button.attrs['aria-pressed'], 'true');
  assert.equal(ui.elements.get('playback-label').textContent, 'Resume');
  button.onclick(); await tick();
  assert.deepEqual(ui.requests[1].body, {action: 'hold', value: false, resume_speed: 0});
  assert.equal(button.attrs['aria-pressed'], 'false');
});

test('failed pause does not show a successful paused state', async () => {
  const ui = await app();
  ui.respondWith(() => ({ok: false, json: async () => ({error: 'Bluetooth write failed'})}));
  ui.elements.get('toggle-playback').onclick(); await tick();
  assert.equal(ui.elements.get('toggle-playback').attrs['aria-pressed'], 'false');
  assert.equal(ui.elements.get('playback-label').textContent, 'Pause');
  assert.equal(ui.elements.get('message').textContent, 'Bluetooth write failed');
});

test('rapid repeated pause clicks send one request and do not update optimistically', async () => {
  const ui = await app();
  let complete;
  ui.respondWith(() => new Promise(resolve => { complete = resolve; }));
  const button = ui.elements.get('toggle-playback');
  button.onclick(); button.onclick();
  assert.equal(ui.requests.length, 1);
  assert.equal(button.attrs['aria-pressed'], 'false');
  assert.equal(ui.elements.get('essentials').disabled, true);
  complete({ok: true, json: async () => ({...ui.status, values: {hold: true}})});
  await tick();
  assert.equal(button.attrs['aria-pressed'], 'true');
  assert.equal(ui.elements.get('essentials').disabled, false);
});

test('disconnected playback cannot submit a command or claim playing', async () => {
  const ui = await app({connected: false});
  assert.equal(ui.elements.get('essentials').disabled, true);
  assert.equal(ui.elements.get('playback-state').textContent, 'Not connected');
  ui.elements.get('toggle-playback').onclick(); await tick();
  assert.equal(ui.requests.length, 0);
});

test('initial hold renders Resume without sending a command', async () => {
  const ui = await app({values: {hold: true, speed: 12, brightness: 60, color: '#123456'}});
  assert.equal(ui.elements.get('toggle-playback').attrs['aria-label'], 'Resume animation');
  assert.equal(ui.elements.get('playback-state').textContent, 'Paused');
  assert.equal(ui.elements.get('effect-speed').value, 12);
  assert.equal(ui.elements.get('brightness').value, 60);
  assert.equal(ui.elements.get('solid-value').textContent, '#123456');
  assert.equal(ui.requests.length, 0);
});

test('empty effect search disables Apply; clearing it restores mode zero', async () => {
  const ui = await app();
  const search = ui.elements.get('effect-search');
  search.value = 'no such effect'; search.oninput();
  assert.equal(ui.elements.get('apply-effect').disabled, true);
  assert.equal(ui.elements.get('effect').options[0].textContent, 'No matching effects');
  search.value = ''; search.oninput();
  assert.equal(ui.elements.get('apply-effect').disabled, false);
  assert.equal(Number(ui.elements.get('effect').options[0].value), 0);
  assert.equal(ui.requests.length, 0);
});

test('all 213 programs remain reachable through catalog pagination', async () => {
  const ui = await app({catalog: fullCatalog});
  assert.equal(ui.elements.get('effect').options.length, 213);
  assert.equal(ui.elements.get('effect-grid').children.length, 24);
  for (let i = 0; i < 8; i++) ui.elements.get('more-effects').onclick();
  assert.equal(ui.elements.get('effect-grid').children.length, 213);
  assert.equal(ui.elements.get('more-effects').hidden, true);
  assert.equal(ui.requests.length, 0);
});

test('offline preview selection and category filters never write to the lamp', async () => {
  const ui = await app({connected: false, catalog: fullCatalog});
  const filters = ui.elements.get('effect-categories').children;
  filters.find(button => button.textContent === 'Reverse').onclick();
  assert.equal(ui.elements.get('effect').options.length, categories.runback.length);
  const card = ui.elements.get('effect-grid').children[2];
  card.onclick();
  assert.equal(Number(ui.elements.get('effect').value), Number(card.value));
  assert.equal(card.attrs['aria-pressed'], 'true');
  assert.equal(ui.elements.get('essentials').disabled, true);
  assert.equal(ui.requests.length, 0);
});

test('preview palette is derived from color names and sequence, not effect IDs', async () => {
  const ui = await app();
  const sequence = ui.evaluate("effectAppearance({id:999, name:'R-G-B Trans Back', category:'trans'})");
  assert.equal(sequence.colors.length, 3);
  assert.equal(sequence.reverse, true);
  const single = ui.evaluate("effectAppearance({id:1000, name:'Green Tail', category:'tail'})");
  assert.equal(single.colors.length, 1);
  assert.equal(single.family, 'tail');
});

test('pause freezes the main illustration while gallery discovery keeps animating without BLE', async () => {
  const ui = await app({values: {hold: true}, animations: true});
  ui.frame(100); ui.frame(160); ui.frame(220);
  assert.equal(ui.evaluate('heroPhase'), 0);
  assert.ok(ui.evaluate('previewPhase') > 0);
  ui.evaluate('state.values.hold = false');
  ui.frame(280);
  assert.ok(ui.evaluate('heroPhase') > 0);
  assert.equal(ui.requests.length, 0);
});

test('reduced motion and hidden documents do not advance illustrative animations', async () => {
  const reduced = await app({animations: true, reducedMotion: true});
  reduced.frame(100); reduced.frame(400);
  assert.equal(reduced.evaluate('previewPhase'), 0);
  const hidden = await app({animations: true});
  hidden.evaluate('document.hidden = true'); hidden.frame(100); hidden.frame(400);
  assert.equal(hidden.evaluate('previewPhase'), 0);
  assert.equal(hidden.requests.length, 0);
});

test('Default and Custom are accessible keyboard tabs and switching never writes to BLE', async () => {
  const ui = await app({catalog:fullCatalog});
  assert.equal(ui.elements.get('default-presets').hidden, false);
  assert.equal(ui.elements.get('custom-presets').hidden, true);
  ui.elements.get('tab-default').onkeydown({key:'ArrowRight',preventDefault(){}});
  assert.equal(ui.elements.get('tab-custom').attrs['aria-selected'], 'true');
  assert.equal(ui.elements.get('tab-custom').focused, true);
  assert.equal(ui.elements.get('default-presets').hidden, true);
  ui.elements.get('tab-custom').onkeydown({key:'Home',preventDefault(){}});
  assert.equal(ui.elements.get('tab-default').attrs.tabindex, '0');
  assert.equal(ui.requests.length, 0);
});

test('Add opens an independent effect chooser with all programs and speed control, without BLE', async () => {
  const ui = await app({catalog:fullCatalog,values:{speed:100}});
  ui.elements.get('effect-search').value = 'no such program'; ui.elements.get('effect-search').oninput();
  ui.elements.get('add-custom-preset').onclick();
  assert.equal(ui.elements.get('preset-dialog').open, true);
  assert.equal(ui.elements.get('capture-effect').options.length, 213);
  assert.equal(ui.elements.get('capture-effect').focused, true);
  assert.equal(ui.elements.get('capture-speed').value, 25);
  assert.equal(ui.elements.get('save-preset').disabled, true);
  assert.equal(ui.requests.length, 0);
});

async function startModalCapture(ui, speed = 12) {
  ui.elements.get('add-custom-preset').onclick();
  ui.elements.get('capture-effect').value = '138'; ui.elements.get('capture-speed').value = String(speed);
  ui.respondWith(() => ({ok:true,json:async () => ({...ui.status,
    capture:{id:'owned',mode:138,speed,stage:'starting',elapsed_ms:0}})}));
  ui.elements.get('start-capture').onclick(); await tick();
}

test('capture sends chosen speed including zero and keeps Pause inside the dialog', async () => {
  const ui = await app({catalog:fullCatalog});
  await startModalCapture(ui,0);
  assert.equal(ui.requests[0].path, '/api/capture');
  assert.deepEqual(ui.requests[0].body, {mode:138,speed:0});
  assert.equal(ui.elements.get('effect-speed').value, 0);
  assert.equal(ui.elements.get('preset-dialog').open, true);
  assert.equal(ui.elements.get('capture-effect').disabled, true);
  assert.equal(ui.elements.get('capture-speed').disabled, true);
  assert.equal(ui.elements.get('capture-pause').disabled, false);
  ui.respondWith(() => ({ok:true,json:async () => ({...ui.status,values:{hold:true},
    capture:{id:'owned',mode:138,speed:0,stage:'paused',elapsed_ms:1234}})}));
  ui.elements.get('capture-pause').onclick(); await tick();
  assert.deepEqual(ui.requests[1].body,{action:'hold',value:true});
  assert.equal(ui.elements.get('preset-time').value,'1.234');
  assert.equal(ui.elements.get('capture-pause-label').textContent,'Paused');
  assert.equal(ui.elements.get('capture-speed').disabled,false);
  ui.elements.get('preset-time').value='1.250'; ui.evaluate('renderState(state)');
  assert.equal(ui.elements.get('preset-time').value,'1.250');
});

test('saving a captured frame includes speed, closes the modal and shows Custom', async () => {
  const ui = await app({catalog:fullCatalog});
  await startModalCapture(ui,12);
  ui.evaluate("renderState({...state,values:{hold:true},capture:{id:'owned',mode:138,speed:12,stage:'paused',elapsed_ms:258}})");
  ui.elements.get('effect').value='89'; ui.elements.get('preset-name').value='Slow cyan';
  ui.respondWith(() => ({ok:true,json:async () => ({presets:[{id:'saved',name:'Slow cyan',mode:138,speed:12,pause_ms:258}]})}));
  ui.elements.get('preset-form').onsubmit({preventDefault(){}}); await tick();
  assert.deepEqual(ui.requests[1].body,{name:'Slow cyan',mode:138,speed:12,pause_ms:258});
  assert.equal(ui.elements.get('preset-dialog').open,false);
  assert.equal(ui.elements.get('tab-custom').attrs['aria-selected'],'true');
  assert.equal(ui.elements.get('preset-count').textContent,'1');
  assert.equal(ui.elements.get('preset-list').children[0].children[0].textContent,'Slow cyan');
});

test('editing restores stored speed and updates the same ID without changing the lamp', async () => {
  const preset={id:'saved',name:'Night',mode:138,speed:0,pause_ms:258};
  const ui = await app({catalog:fullCatalog,savedPresets:[preset]});
  ui.elements.get('preset-list').children[0].children[2].children[1].onclick();
  assert.equal(ui.elements.get('preset-dialog').open,true);
  assert.equal(ui.elements.get('capture-speed').value,0);
  ui.elements.get('preset-time').value='.3';
  ui.respondWith(() => ({ok:true,json:async () => ({presets:[{...preset,pause_ms:300}]})}));
  ui.elements.get('preset-form').onsubmit({preventDefault(){}}); await tick();
  assert.deepEqual(ui.requests[0].body,{id:'saved',name:'Night',mode:138,speed:0,pause_ms:300});
  assert.equal(ui.requests[0].path,'/api/preset-save');
});

test('replay honors saved slow speed even outside the current filter', async () => {
  const ui=await app({catalog:fullCatalog,savedPresets:[{id:'saved',name:'Night',mode:138,speed:7,pause_ms:258}]});
  ui.elements.get('effect-search').value='no result'; ui.elements.get('effect-search').oninput();
  ui.respondWith(() => ({ok:true,json:async () => ({...ui.status,capture:{id:'replay',mode:138,speed:7,stage:'starting',elapsed_ms:0}})}));
  ui.elements.get('preset-list').children[0].children[2].children[0].onclick(); await tick();
  assert.deepEqual(ui.requests[0].body,{id:'saved'});
  assert.equal(ui.elements.get('effect-speed').value,7);
  assert.equal(Number(ui.elements.get('effect').value),138);
  assert.equal(ui.elements.get('preset-dialog').open,undefined);
});

test('offline custom presets can be edited but capture and replay cannot transmit', async () => {
  const ui=await app({connected:false,savedPresets:[{id:'saved',name:'Old',mode:0,pause_ms:258}]});
  const actions=ui.elements.get('preset-list').children[0].children[2].children;
  assert.equal(actions[0].disabled,true); actions[0].onclick();
  actions[1].onclick(); ui.elements.get('start-capture').onclick(); await tick();
  assert.equal(ui.requests.length,0);
  assert.equal(ui.elements.get('capture-speed').value,100);
  assert.equal(ui.elements.get('save-preset').disabled,false);
});

test('closing an active capture pauses the lamp before dismissing and restores focus', async () => {
  const ui=await app({catalog:fullCatalog}); await startModalCapture(ui);
  ui.respondWith(() => ({ok:true,json:async () => ({...ui.status,values:{hold:true},capture:{id:'owned',mode:138,speed:12,stage:'paused',elapsed_ms:1000}})}));
  await ui.elements.get('close-preset-dialog').onclick();
  assert.deepEqual(ui.requests[1].body,{action:'hold',value:true});
  assert.equal(ui.elements.get('preset-dialog').open,false);
  assert.equal(ui.elements.get('add-custom-preset').focused,true);
});

test('Escape dismisses a draft without writes and failed capture stays open with an error', async () => {
  const ui=await app(); ui.elements.get('add-custom-preset').onclick();
  let prevented=false;
  ui.elements.get('preset-dialog').oncancel({preventDefault(){prevented=true;}}); await tick();
  assert.equal(prevented,true); assert.equal(ui.elements.get('preset-dialog').open,false);
  assert.equal(ui.requests.length,0);
  ui.elements.get('add-custom-preset').onclick();
  ui.respondWith(() => ({ok:false,json:async () => ({error:'Bluetooth write failed'})}));
  ui.elements.get('start-capture').onclick(); await tick();
  assert.equal(ui.elements.get('preset-dialog').open,true);
  assert.equal(ui.elements.get('preset-message').textContent,'Bluetooth write failed');
  assert.equal(ui.elements.get('capture-pause').disabled,true);
});

test('changing speed after capture requires a new capture or explicit timing', async () => {
  const ui=await app({catalog:fullCatalog}); await startModalCapture(ui);
  ui.evaluate("renderState({...state,values:{hold:true},capture:{id:'owned',mode:138,speed:12,stage:'paused',elapsed_ms:258}})");
  ui.elements.get('capture-speed').value='9'; ui.elements.get('capture-speed').onchange();
  assert.equal(ui.elements.get('preset-time').value,'');
  assert.equal(ui.elements.get('save-preset').disabled,true);
  ui.elements.get('preset-time').value='0'; ui.elements.get('preset-time').oninput();
  assert.equal(ui.elements.get('save-preset').disabled,false);
});

test('an unrelated replay cannot overwrite an open preset draft', async () => {
  const ui=await app({catalog:fullCatalog}); ui.elements.get('add-custom-preset').onclick();
  ui.elements.get('preset-time').value='2.000';
  ui.evaluate("renderState({...state,values:{hold:true},capture:{id:'other',mode:138,speed:100,stage:'paused',elapsed_ms:258}})");
  assert.equal(ui.elements.get('preset-time').value,'2.000');
});

test('delete only changes local storage and updates the Custom count', async () => {
  const ui=await app({savedPresets:[{id:'saved',name:'Night',mode:0,speed:25,pause_ms:258}]});
  ui.respondWith(() => ({ok:true,json:async () => ({presets:[]})}));
  ui.elements.get('preset-list').children[0].children[2].children[2].onclick(); await tick();
  assert.equal(ui.requests[0].path,'/api/preset-delete');
  assert.equal(ui.elements.get('preset-count').textContent,'0');
});

const sync = (overrides = {}) => ({enabled: false, listening: true, port: 8421, rate: 15, receiving: false, color: null,
  received: 0, forwarded: 0, reconnecting: false, error: null, ...overrides});

test('SignalRGB switch posts the toggle and renders live state without lamp commands', async () => {
  const ui = await app({signalrgb: sync()});
  const toggle = ui.elements.get('signalrgb-toggle');
  assert.equal(toggle.attrs['aria-checked'], 'false');
  assert.equal(toggle.disabled, false);
  ui.respondWith(() => ({ok: true, json: async () => ({...ui.status,
    signalrgb: sync({enabled: true, receiving: true, color: '#120030', received: 40, forwarded: 12})})}));
  toggle.onclick(); await tick(); await tick();
  assert.deepEqual(ui.requests.map(request => [request.path, request.body]), [['/api/signalrgb', {enabled: true}]]);
  assert.equal(toggle.attrs['aria-checked'], 'true');
  assert.equal(toggle.textContent, 'On');
  assert.equal(ui.elements.get('signalrgb-detail').textContent, 'Live. SignalRGB is coloring the lamp.');
  assert.equal(ui.elements.get('signalrgb-swatch').style.background, '#120030');
  assert.equal(ui.elements.get('signalrgb-stats').textContent, '40 received · 12 sent to lamp · max 15/s');
  assert.equal(ui.elements.get('message').textContent, 'SignalRGB sync on.');
});

test('a manual control that stops sync explains why; turning it off yourself does not', async () => {
  const ui = await app({signalrgb: sync({enabled: true})});
  ui.evaluate(`renderState(${JSON.stringify({...ui.status, signalrgb: sync({enabled: false})})})`);
  assert.equal(ui.elements.get('message').textContent, 'SignalRGB sync turned off because you used a manual control.');

  const own = await app({signalrgb: sync({enabled: true})});
  own.respondWith(() => ({ok: true, json: async () => ({...own.status, signalrgb: sync({enabled: false})})}));
  own.elements.get('signalrgb-toggle').onclick(); await tick(); await tick();
  assert.deepEqual(own.requests[0].body, {enabled: false});
  assert.equal(own.elements.get('message').textContent, 'SignalRGB sync off.');
});

test('sync can be switched off while reconnecting but not on while disconnected', async () => {
  const reconnecting = await app({connected: false, signalrgb: sync({enabled: true, reconnecting: true})});
  assert.equal(reconnecting.elements.get('signalrgb-toggle').disabled, false);
  assert.equal(reconnecting.elements.get('signalrgb-detail').textContent, 'Bluetooth link lost. Reconnecting to your lamp…');
  const offline = await app({connected: false, signalrgb: sync()});
  assert.equal(offline.elements.get('signalrgb-toggle').disabled, true);
  const busyPort = await app({signalrgb: sync({listening: false, error: 'SignalRGB port 8421 is unavailable: in use. Close the other program using it and restart the app.'})});
  assert.equal(busyPort.elements.get('signalrgb-toggle').disabled, true);
});
