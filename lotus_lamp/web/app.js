"use strict";
const $ = (id) => document.getElementById(id);
let state = null, busy = false, modes = [];
let presets = [], editingPreset = null, lastPausedCapture = null;
let captureSessionId = null, presetTab = 'default', dialogPhase = 0;
let preferredCaptureSpeed = 25;
let captureReceivedAt = 0;

function message(text, error = false) {
  const target = $("preset-dialog").open ? $("preset-message") : $("message");
  target.textContent = text;
  target.classList.toggle("error", error);
}

async function api(path, body) {
  const response = await fetch(
    `/api/${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Lotus-Local": "1" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The lamp request failed.");
  return data;
}

function renderState(next) {
  state = next;
  $("connection-state").textContent = next.connected
    ? "Connected"
    : "Disconnected";
  $("connection-state").classList.toggle("connected", next.connected);
  $("device-name").textContent =
    next.device?.name || next.saved?.name || "Choose your lamp";
  $("device-detail").textContent = next.connected
    ? "Bluetooth link active. Ready to send controls."
    : "Power it on, keep it nearby, and close its phone app.";
  $("disconnect").hidden = !next.connected;
  $("reconnect").hidden = next.connected || !next.saved;
  $("essentials").disabled = busy || !next.connected;
  $("scan").disabled = busy;
  $("scan").textContent = busy ? "Working…" : "Scan for lamps";
  $("reconnect").disabled = busy;
  $("disconnect").disabled = busy;
  const held = next.values?.hold === true && next.capture?.stage !== 'starting';
  $("toggle-playback").setAttribute("aria-pressed", String(held));
  $("toggle-playback").setAttribute("aria-label", held ? "Resume animation" : "Pause animation");
  $("playback-label").textContent = held ? "Resume" : "Pause";
  $("playback-state").textContent = !next.connected ? "Not connected"
    : next.capture?.stage === 'starting' ? 'Starting…'
    : held ? "Paused" : next.values?.hold === false ? "Playing" : "Ready";
  for (const [id, value] of [["power-on", true], ["power-off", false]]) {
    if (typeof next.values?.power === "boolean")
      $(id).setAttribute("aria-pressed", String(next.values.power === value));
    else $(id).removeAttribute("aria-pressed");
  }
  document.querySelectorAll(".device-row button").forEach((button) => {
    button.disabled = busy;
  });
  captureReceivedAt = Date.now();
  const capture = next.capture;
  if (capture?.stage === 'paused' && capture.id === captureSessionId && capture.id !== lastPausedCapture) {
    lastPausedCapture = capture.id;
    $('capture-effect').value = capture.mode;
    $('capture-speed').value = capture.speed ?? 100;
    $('preset-time').value = (capture.elapsed_ms / 1000).toFixed(3);
  }
  renderCapture();
  renderPresetControls();
}

function programName(id) {
  return modes.find(mode => mode.id === id)?.name || `Program ${id}`;
}

function ownedCapture() {
  return state?.capture?.id === captureSessionId ? state.capture : null;
}

function captureActive() {
  return ['starting', 'running'].includes(ownedCapture()?.stage);
}

function renderCapture() {
  const active = state?.capture;
  if (active?.stage === 'running') {
    const elapsed = active.elapsed_ms + Date.now() - captureReceivedAt;
    $('playback-state').textContent = `Capture · ${(elapsed / 1000).toFixed(3)} s`;
  }
  const capture = ownedCapture();
  let elapsed = capture?.elapsed_ms ?? Math.round(Number($('preset-time').value || 0) * 1000);
  if (capture?.stage === 'running') elapsed += Date.now() - captureReceivedAt;
  $('capture-time').textContent = `${(elapsed / 1000).toFixed(3)} s`;
  const labels = {starting: `Starting at ${capture?.speed ?? 100}%…`, running: 'Pause when you find your frame',
    paused: 'Frame held · ready to save', cancelled: 'Capture ended · start again'};
  $('capture-state').textContent = !state?.connected ? 'Connect your lamp to capture'
    : labels[capture?.stage] || (editingPreset ? 'Saved timing · edit or capture again' : 'Ready when you are');
}

function renderPresetControls() {
  const mode = Number($('capture-effect').value);
  const hasMode = $('capture-effect').value !== '' && modes.some(item => item.id === mode);
  const active = captureActive();
  $('add-custom-preset').disabled = busy;
  $('start-capture').disabled = busy || !state?.connected || !hasMode || active;
  $('start-capture').textContent = ownedCapture() ? 'Capture again' : 'Start capture';
  $('capture-effect').disabled = busy || active;
  $('capture-speed').disabled = busy || active;
  $('capture-speed-value').textContent = `${$('capture-speed').value}%`;
  $('capture-pause').disabled = busy || !state?.connected || !active;
  const paused = ownedCapture()?.stage === 'paused';
  $('capture-pause-label').textContent = paused ? 'Paused' : 'Pause';
  $('capture-pause').setAttribute('data-paused', String(paused));
  const timing = $('preset-time').value;
  const validTime = timing !== '' && Number.isFinite(Number(timing)) && Number(timing) >= 0 && Number(timing) <= 600;
  $('preset-time').disabled = busy || active;
  $('save-preset').disabled = busy || active || !hasMode || !validTime;
  $('save-preset').textContent = editingPreset ? 'Update preset' : 'Save preset';
  $('close-preset-dialog').disabled = busy;
  $('cancel-preset-dialog').disabled = busy;
  $('preset-program').textContent = `Program: ${programName(mode)} · ${$('capture-speed').value}% speed`;
  document.querySelectorAll('.preset-play').forEach(button => { button.disabled = busy || !state?.connected; });
  document.querySelectorAll('.preset-edit, .preset-delete').forEach(button => { button.disabled = busy; });
}

function choosePresetTab(tab, focus = false) {
  presetTab = tab;
  for (const key of ['default', 'custom']) {
    const selected = tab === key;
    $(`tab-${key}`).setAttribute('aria-selected', String(selected));
    $(`tab-${key}`).setAttribute('tabindex', selected ? '0' : '-1');
    $(`${key}-presets`).hidden = !selected;
  }
  if (focus) $(`tab-${tab}`).focus();
}

function openPresetDialog(preset = null) {
  if (busy || $('preset-dialog').open) return;
  editingPreset = preset?.id ?? null; captureSessionId = null;
  $('preset-dialog-title').textContent = preset ? 'Edit custom preset' : 'Add custom preset';
  const selected = Number($('effect').value);
  $('capture-effect').value = preset?.mode ?? (modes.some(mode => mode.id === selected) ? selected : modes[0]?.id);
  $('capture-speed').value = preset?.speed ?? (preset ? 100 : preferredCaptureSpeed);
  $('preset-name').value = preset?.name ?? '';
  $('preset-time').value = preset ? (preset.pause_ms / 1000).toFixed(3) : '';
  $('preset-message').textContent = '';
  dialogPhase = 0;
  renderCapture(); renderPresetControls();
  $('preset-dialog').showModal();
  $('capture-effect').focus();
}

function finishPresetDialog() {
  $('preset-dialog').close(); captureSessionId = null; editingPreset = null;
  $('add-custom-preset').focus();
}

async function closePresetDialog() {
  if (busy) return;
  if (captureActive() && state?.connected) {
    const result = await run(() => api('command', {action: 'hold', value: true}), 'Pausing capture…', 'Capture paused.');
    if (!result) return;
  }
  finishPresetDialog();
}

function renderPresets(data) {
  presets = data.presets;
  $('preset-count').textContent = String(presets.length);
  const list = $('preset-list'); list.replaceChildren();
  if (!presets.length) {
    const empty = document.createElement('p'); empty.className = 'preset-empty';
    empty.textContent = data.notice || 'No custom presets yet. Add one to capture your first frame.';
    list.append(empty);
  }
  presets.forEach(preset => {
    const item = document.createElement('article'); item.className = 'preset-item';
    const title = document.createElement('strong'); title.textContent = preset.name;
    const detail = document.createElement('p');
    const speed = preset.speed ?? 100;
    detail.textContent = `${programName(preset.mode)} · ${(preset.pause_ms / 1000).toFixed(3)} s · ${speed}%`;
    const actions = document.createElement('div'); actions.className = 'preset-actions';
    const play = document.createElement('button'); play.className = 'button preset-play';
    play.textContent = 'Replay'; play.setAttribute('aria-label', `Replay ${preset.name}`);
    play.disabled = busy || !state?.connected;
    play.onclick = () => {
      if (busy || !state?.connected) return;
      run(async () => {
        const result = await api('preset-play', {id: preset.id});
        selectPresetProgram(preset.mode, speed);
        return result;
      }, 'Starting preset…', `Replaying at ${speed}%. Pause will happen automatically.`);
    };
    const edit = document.createElement('button'); edit.className = 'text-button preset-edit';
    edit.textContent = 'Edit'; edit.setAttribute('aria-label', `Edit ${preset.name}`);
    edit.onclick = () => openPresetDialog(preset);
    const remove = document.createElement('button'); remove.className = 'text-button preset-delete';
    remove.textContent = 'Delete'; remove.setAttribute('aria-label', `Delete ${preset.name}`);
    remove.onclick = () => run(async () => {
      renderPresets(await api('preset-delete', {id: preset.id}));
    }, 'Deleting preset…', 'Preset deleted.');
    actions.append(play, edit, remove); item.append(title, detail, actions); list.append(item);
  });
  renderPresetControls();
}

function selectPresetProgram(mode, speed) {
  category = 'all'; catalogLimit = 24; $('effect-search').value = '';
  renderCategories(); renderModes(); $('effect').value = mode; renderModes();
  $('effect-speed').value = speed; $('effect-speed-value').textContent = `${speed}%`;
  heroPhase = 0;
}

async function run(operation, progress, success) {
  if (busy) return;
  busy = true;
  if (state) renderState(state);
  message(progress);
  try {
    const result = await operation();
    if (result && typeof result.connected === "boolean") renderState(result);
    message(result?.notice || success);
    return result;
  } catch (error) {
    message(error.message, true);
    try {
      renderState(await api("status"));
    } catch {
      /* Keep the actionable operation error. */
    }
  } finally {
    busy = false;
    if (state) renderState(state);
  }
}

function renderDevices(devices) {
  $("devices").replaceChildren();
  if (!devices.length) {
    $("devices").textContent =
      "No devices found. Check Bluetooth permission and close the phone app, then scan again.";
    return;
  }
  // Show likely lamps first; reveal other devices for controllers with different names.
  const likely = devices.filter((device) => device.likely);
  const others = devices.filter((device) => !device.likely);
  function add(device, parent) {
    const row = document.createElement("div");
    row.className = "device-row";
    const info = document.createElement("div"),
      title = document.createElement("strong"),
      detail = document.createElement("p");
    title.textContent = device.name;
    detail.textContent = `${device.address} · ${device.rssi} dBm`;
    info.append(title, detail);
    const button = document.createElement("button");
    button.className = "secondary";
    button.textContent = "Connect";
    button.setAttribute("aria-label", `Connect to ${device.name}`);
    button.onclick = () =>
      run(
        () => api("connect", device),
        `Connecting to ${device.name}…`,
        "Connected.",
      );
    row.append(info, button);
    parent.append(row);
  }
  likely.forEach((device) => add(device, $("devices")));
  if (others.length) {
    const details = document.createElement("details"),
      summary = document.createElement("summary");
    summary.textContent = `Other Bluetooth devices (${others.length})`;
    details.append(summary);
    others.forEach((device) => add(device, details));
    $("devices").append(details);
  }
}

// Preview colors come from the existing mode names. These illustrate families;
// the controller's firmware renderer and exact animation phase are not decoded.
const previewColors = {
  red: '#ff366e', green: '#39f6a2', blue: '#527aff', cyan: '#25e8ff',
  yellow: '#ffe05b', purple: '#c268ff', white: '#eef7ff',
};
const colorInitials = {R:'red', G:'green', B:'blue', C:'cyan', Y:'yellow', P:'purple', W:'white'};
const categoryNames = {basic:'Classic', curtain:'Curtain', trans:'Transitions', water:'Water', flow:'Flow', tail:'Trails', run:'Forward', runback:'Reverse'};
let category = 'all', catalogLimit = 24, previewEntries = [], previewPhase = 0;
let heroPhase = 0;

function effectAppearance(mode) {
  const name = mode?.name || 'Auto Play';
  const sequence = name.match(/\b[RGBYCWP](?:-[RGBYCWP])+\b/);
  const named = [...name.toLowerCase().matchAll(/\b(red|green|blue|cyan|yellow|purple|white)\b/g)].map(match => match[1]);
  const names = /[67]-Color|Magic|Auto Play/.test(name)
    ? Object.keys(previewColors).slice(0, name.includes('6-Color') ? 6 : 7)
    : sequence ? sequence[0].split('-').map(initial => colorInitials[initial]) : named;
  return {colors: (names.length ? names : Object.keys(previewColors)).map(color => previewColors[color]),
    family: mode?.category || 'basic', reverse: /back/i.test(name)};
}

function selectedEffect() {
  return modes.find(mode => mode.id === Number($('effect').value)) || modes[0];
}

function renderCatalog(matching) {
  const grid = $('effect-grid');
  grid.replaceChildren();
  previewEntries = [];
  $('effect-count').textContent = `${matching.length} ${matching.length === 1 ? "program" : "programs"}`;
  matching.slice(0, catalogLimit).forEach(mode => {
    const button = document.createElement('button');
    button.className = 'effect-card'; button.value = mode.id;
    button.setAttribute('aria-label', `Preview ${mode.name}`);
    button.setAttribute('aria-pressed', String(String(mode.id) === String($('effect').value)));
    const canvas = document.createElement('canvas');
    canvas.width = 240; canvas.height = 60;
    canvas.setAttribute('aria-hidden', 'true');
    const title = document.createElement('strong'); title.textContent = mode.name;
    const detail = document.createElement('span'); detail.textContent = `${categoryNames[mode.category] || mode.category} · ${String(mode.id).padStart(3, '0')}`;
    button.append(canvas, title, detail);
    button.onclick = () => {
      $('effect').value = mode.id; heroPhase = 0;
      for (const card of grid.children) card.setAttribute('aria-pressed', String(String(card.value) === String(mode.id)));
      renderPresetControls();
    };
    grid.append(button);
    if (typeof canvas.getContext === 'function') previewEntries.push({canvas, mode, ctx: canvas.getContext('2d')});
  });
  if (!matching.length) {
    const empty = document.createElement('p'); empty.textContent = 'No matching effects. Try another color or name.';
    grid.append(empty);
  }
  $('more-effects').hidden = matching.length <= catalogLimit;
}

function renderCategories() {
  const parent = $('effect-categories'); parent.replaceChildren();
  [['all', 'All'], ...Object.entries(categoryNames)].forEach(([key, name]) => {
    const button = document.createElement('button');
    button.className = 'category-button'; button.textContent = name;
    button.setAttribute('aria-pressed', String(category === key));
    button.onclick = () => { category = key; catalogLimit = 24; renderCategories(); renderModes(); };
    parent.append(button);
  });
}

function drawEffect(ctx, width, height, mode, time, vertical = false) {
  if (!ctx) return;
  const appearance = effectAppearance(mode), colors = appearance.colors;
  // Horizontal right maps to vertical up; Back travels left/down.
  const phase = (appearance.reverse ? -time : time) * (vertical ? -1 : 1);
  ctx.clearRect(0, 0, width, height);
  const count = vertical ? 40 : 32;
  const length = vertical ? height - 30 : width - 16;
  for (let i = 0; i < count; i++) {
    const p = i / count;
    const progress = ((p - phase) % 1 + 1) % 1;
    let index = Math.floor(progress * colors.length) % colors.length;
    let alpha = 1;
    if (['run', 'runback', 'tail'].includes(appearance.family)) {
      alpha = .2 + .8 * Math.max(0, 1 - progress * 2);
    } else if (appearance.family === 'flow') {
      index = Math.floor((phase % 1 + 1) % 1 * colors.length);
      alpha = .45 + .55 * (Math.sin(phase * Math.PI * 2) + 1) / 2;
    } else if (appearance.family === 'curtain') {
      alpha = Math.abs(p - .5) < (Math.sin(phase * Math.PI * 2) + 1) / 2 ? 1 : .15;
    } else if (appearance.family === 'water') {
      index = Math.floor(((Math.floor(p * 8) / 8 - phase) % 1 + 1) % 1 * colors.length);
      alpha = .35 + .65 * (Math.sin((p - phase) * Math.PI * 4) + 1) / 2;
    } else if (colors.length === 1 && appearance.family === 'basic') {
      alpha = .4 + .6 * (Math.sin(phase * Math.PI * 2) + 1) / 2;
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors[index]; ctx.shadowColor = colors[index]; ctx.shadowBlur = vertical ? 24 : 10;
    if (vertical) ctx.fillRect(width / 2 - 7, 8 + i * length / count, 14, length / count + 1);
    else ctx.fillRect(8 + i * length / count, height / 2 - 5, length / count + 1, 10);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  if (vertical) {
    ctx.fillStyle = '#536c89'; ctx.fillRect(width / 2 - 28, height - 14, 56, 3);
  }
}

function startPreviews() {
  const hero = $('regime-preview');
  if (typeof hero.getContext !== 'function' || typeof requestAnimationFrame !== 'function') return;
  const heroContext = hero.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const captureCanvas = $('capture-preview'), captureContext = captureCanvas.getContext('2d');
  let lastDraw = 0;
  function frame(now) {
    const dt = lastDraw ? Math.min(now - lastDraw, 100) / 1000 : 0;
    if (!document.hidden && !reduced.matches && now - lastDraw >= 50) {
      const seconds = Math.max(1.5, 12 - Number($('effect-speed').value) / 10);
      previewPhase += dt / seconds;
      if (state?.values?.hold !== true) heroPhase += dt / seconds;
      if ($('preset-dialog').open) {
        if (ownedCapture()?.stage !== 'paused') dialogPhase += dt / Math.max(1.5, 12 - Number($('capture-speed').value) / 10);
        drawEffect(captureContext, captureCanvas.width, captureCanvas.height,
          modes.find(mode => mode.id === Number($('capture-effect').value)), dialogPhase, true);
      }
      lastDraw = now;
      drawEffect(heroContext, hero.width, hero.height, selectedEffect(), heroPhase, true);
      previewEntries.forEach(entry => {
        const rect = entry.canvas.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight)
          drawEffect(entry.ctx, entry.canvas.width, entry.canvas.height, entry.mode, previewPhase);
      });
    } else if (!document.hidden && reduced.matches && now - lastDraw >= 200) {
      lastDraw = now;
      drawEffect(heroContext, hero.width, hero.height, selectedEffect(), 0, true);
      previewEntries.forEach(entry => drawEffect(entry.ctx, entry.canvas.width, entry.canvas.height, entry.mode, 0));
      if ($('preset-dialog').open) drawEffect(captureContext, captureCanvas.width, captureCanvas.height,
        modes.find(mode => mode.id === Number($('capture-effect').value)), 0, true);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function renderModes() {
  const query = $("effect-search").value.toLowerCase(),
    previous = $("effect").value;
  $("effect").replaceChildren();
  const matching = modes.filter((mode) =>
      (category === "all" || mode.category === category) &&
      `${mode.id} ${mode.name} ${mode.category}`.toLowerCase().includes(query),
    );
  matching.forEach((mode) => {
      const option = document.createElement("option");
      option.value = mode.id;
      option.textContent = `${mode.id} · ${mode.name}`;
      $("effect").append(option);
    });
  if ([...$("effect").options].some((option) => option.value === previous))
    $("effect").value = previous;
  if (!matching.length) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "No matching effects";
    $("effect").append(empty);
  }
  $("apply-effect").disabled = !matching.length;
  renderCatalog(matching);
  renderPresetControls();
}

$("scan").onclick = () =>
  run(
    async () => {
      const result = await api("scan", {});
      renderDevices(result.devices);
      return result;
    },
    "Scanning nearby Bluetooth devices…",
    "Scan finished. Select your lamp.",
  );
$("reconnect").onclick = () =>
  run(
    () => api("connect", state.saved),
    "Reconnecting to your saved lamp…",
    "Connected to your saved lamp.",
  );
$("disconnect").onclick = () =>
  run(
    () => api("disconnect", {}),
    "Disconnecting…",
    "Disconnected.",
  );
const command = (action, value) =>
  run(
    () => api("command", { action, value }),
    "Sending lamp control…",
    "Applied.",
  );
$("power-on").onclick = () => command("power", true);
$("power-off").onclick = () => command("power", false);
$("apply-solid").onclick = () => command("color", $("solid").value);
for (const id of ["brightness", "effect-speed"]) {
  $(id).oninput = () => {
    $(`${id}-value`).textContent = `${$(id).value}%`;
  };
}
$("brightness").onchange = () =>
  command("brightness", Number($("brightness").value));
$("effect-speed").onchange = () =>
  command("speed", Number($("effect-speed").value));
$("toggle-playback").onclick = () => {
  if (busy || !state?.connected) return;
  const resume = state.values?.hold === true && state.capture?.stage !== 'starting';
  run(
    () => api("command", resume
      ? { action: "hold", value: false, resume_speed: Number($("effect-speed").value) }
      : { action: "hold", value: true }),
    resume ? "Resuming…" : "Pausing…",
    resume ? "Resumed." : "Paused.",
  );
};
$("apply-effect").onclick = () =>
  run(
    async () => {
      await api("command", {
        action: "mode",
        value: Number($("effect").value),
      });
      return api("command", {
        action: "speed",
        value: Number($("effect-speed").value),
      });
    },
    "Sending built-in effect…",
    "Effect applied.",
  );
$("effect-search").oninput = () => { catalogLimit = 24; renderModes(); };
$("effect").onchange = () => { heroPhase = 0; renderModes(); };
$("more-effects").onclick = () => { catalogLimit += 24; renderModes(); };
$("solid").oninput = () => {
  $("solid-value").textContent = $("solid").value.toUpperCase();
};
$('add-custom-preset').onclick = () => openPresetDialog();
$('close-preset-dialog').onclick = closePresetDialog;
$('cancel-preset-dialog').onclick = closePresetDialog;
$('preset-dialog').oncancel = event => { event.preventDefault(); closePresetDialog(); };
for (const key of ['default', 'custom']) {
  $(`tab-${key}`).onclick = () => choosePresetTab(key);
  $(`tab-${key}`).onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    choosePresetTab(event.key === 'Home' ? 'default' : event.key === 'End' ? 'custom'
      : presetTab === 'default' ? 'custom' : 'default', true);
  };
}
function captureSelectionChanged() {
  if (captureActive() || busy) return;
  preferredCaptureSpeed = Number($('capture-speed').value);
  captureSessionId = null; dialogPhase = 0;
  if (!editingPreset) $('preset-time').value = '';
  renderCapture(); renderPresetControls();
}
$('capture-effect').onchange = captureSelectionChanged;
$('capture-speed').oninput = () => { $('capture-speed-value').textContent = `${$('capture-speed').value}%`; };
$('capture-speed').onchange = captureSelectionChanged;
$('start-capture').onclick = () => {
  if (busy || !state?.connected || captureActive() || $('capture-effect').value === '') return;
  const mode = Number($('capture-effect').value), speed = Number($('capture-speed').value);
  run(async () => {
    const result = await api('capture', {mode, speed});
    captureSessionId = result.capture.id;
    $('preset-time').value = ''; dialogPhase = 0;
    selectPresetProgram(mode, speed);
    return result;
  }, 'Starting capture…', `Running at ${speed}%. Pause when you find your frame.`);
};
$('capture-pause').onclick = () => {
  if (busy || !state?.connected || !captureActive()) return;
  run(() => api('command', {action:'hold', value:true}), 'Pausing…', 'Frame held. Give it a name and save.');
};
$('preset-form').onsubmit = event => {
  event.preventDefault();
  if (busy || captureActive()) return;
  const body = {name: $('preset-name').value, mode: Number($('capture-effect').value),
    speed: Number($('capture-speed').value), pause_ms: Math.round(Number($('preset-time').value) * 1000)};
  if (editingPreset) body.id = editingPreset;
  run(async () => {
    renderPresets(await api('preset-save', body));
    choosePresetTab('custom'); finishPresetDialog();
  }, 'Saving preset…', 'Preset saved locally.');
};
$('preset-time').oninput = () => { renderCapture(); renderPresetControls(); };
async function initialize() {
  try {
    const [current, availableModes, savedPresets] = await Promise.all([
      api("status"),
      api("modes"),
      api("presets"),
    ]);
    modes = availableModes;
    $('capture-effect').replaceChildren();
    modes.forEach(mode => {
      const option = document.createElement('option'); option.value = mode.id;
      option.textContent = `${mode.id} · ${mode.name}`; $('capture-effect').append(option);
    });
    choosePresetTab('default');
    renderCategories();
    renderModes();
    // Restore successful selections recorded by this server, never guessed device state.
    if (Number.isInteger(current.values?.mode)) $("effect").value = current.values.mode;
    for (const [key, id] of [["speed", "effect-speed"], ["brightness", "brightness"]]) {
      if (Number.isInteger(current.values?.[key])) {
        $(id).value = current.values[key];
        $(`${id}-value`).textContent = `${current.values[key]}%`;
      }
    }
    if (current.values?.color) {
      $("solid").value = current.values.color;
      $("solid-value").textContent = current.values.color.toUpperCase();
    }
    renderState(current);
    renderModes();
    renderPresets(savedPresets);
    startPreviews();
    if (current.notice) message(current.notice, true);
  } catch (error) {
    message(
      `Cannot reach the local app: ${error.message}. Keep the launcher running, then reload.`,
      true,
    );
  }
}
initialize();
setInterval(async () => {
  if (busy || document.hidden) return;
  try {
    renderState(await api("status"));
  } catch {
    if (state) renderState({ ...state, connected: false });
    message(
      "Local server is unavailable. Restart the launcher and reload.",
      true,
    );
  }
}, 500);
setInterval(() => { if (!document.hidden) renderCapture(); }, 100);
