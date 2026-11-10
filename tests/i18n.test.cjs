// Translation contracts for lotus_lamp/web/i18n.js; Node's built-in runner.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('lotus_lamp/web/i18n.js', 'utf8');
const appSource = fs.readFileSync('lotus_lamp/web/app.js', 'utf8');

function load({language = 'en', saved = null} = {}) {
  const context = vm.createContext({
    navigator: {language, languages: [language]},
    localStorage: {getItem: () => saved, setItem() {}},
  });
  vm.runInContext(source, context);
  return context.LotusI18n;
}

test('detects Spanish from the browser and English otherwise', () => {
  assert.equal(load({language: 'es-ES'}).language, 'es');
  assert.equal(load({language: 'es-419'}).language, 'es');
  assert.equal(load({language: 'en-US'}).language, 'en');
  assert.equal(load({language: 'fr-FR'}).language, 'en');
});

test('a saved choice wins over the browser language', () => {
  assert.equal(load({language: 'es-ES', saved: 'en'}).language, 'en');
  assert.equal(load({language: 'en-US', saved: 'es'}).language, 'es');
});

test('English returns the source text with values filled in', () => {
  const {t} = load();
  assert.equal(t('Scan for lamps'), 'Scan for lamps');
  assert.equal(t('Connecting to {name}…', {name: 'MELK'}), 'Connecting to MELK…');
});

test('Spanish translates interface text, values and server messages', () => {
  const {t} = load({language: 'es'});
  assert.equal(t('Scan for lamps'), 'Buscar lámparas');
  assert.equal(t('Connecting to {name}…', {name: 'MELK'}), 'Conectando a MELK…');
  assert.equal(t('{count} programs', {count: 213}), '213 programas');
  assert.equal(t('Connect to your lamp first.'), 'Primero conecta tu lámpara.');
  assert.equal(t('Brightness must be an integer from 0 to 100.'), 'Brillo debe ser un número entero de 0 a 100.');
  assert.match(t('Bluetooth operation failed: boom. Check Bluetooth permission, keep the lamp nearby, and close its phone app.'),
    /^La operación Bluetooth falló: boom\./);
  assert.equal(t('Some unknown text'), 'Some unknown text');
});

test('every literal t() key in app.js has a Spanish translation', () => {
  const {t} = load({language: 'es'});
  const keys = [...appSource.matchAll(/\bt\((["'])((?:(?!\1).)+)\1/g)].map(match => match[2]);
  assert.ok(keys.length > 20);
  const missing = keys.filter(key => t(key) === key);
  assert.deepEqual(missing, []);
});

test('SignalRGB panel strings are translated, including the busy-port message', () => {
  const {t} = load({language: 'es'});
  for (const key of ['SignalRGB sync', 'Live. SignalRGB is coloring the lamp.',
    'SignalRGB sync turned off because you used a manual control.', 'Bluetooth link lost. Reconnecting to your lamp…',
    'Waiting for SignalRGB. Install the Lotus Lamp plugin and apply an effect.'])
    assert.notEqual(t(key), key);
  assert.equal(t('{received} received · {sent} sent to lamp · max {rate}/s', {received: 3, sent: 2, rate: 15}),
    '3 recibidos · 2 enviados a la lámpara · máx. 15/s');
  assert.match(t('SignalRGB port 8421 is unavailable: in use. Close the other program using it and restart the app.'),
    /^El puerto 8421 de SignalRGB no está disponible: in use\./);
});
