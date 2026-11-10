"use strict";
// Interface translations. Keys are the English source text; English is the fallback.
// Server messages are translated here too, so the API keeps returning English.
(function () {
  const es = {
    // Page and header
    "Lotus · Lamp control": "Lotus · Control de lámpara",
    "/ lamp control": "/ control de lámpara",
    "Language": "Idioma",
    "Disconnected": "Desconectada",
    "Connected": "Conectada",
    "Connect": "Conectar",
    "Connection": "Conexión",
    "Connection settings": "Ajustes de conexión",
    "Bluetooth connection": "Conexión Bluetooth",
    "Choose your lamp": "Elige tu lámpara",
    "Power it on and close its phone app.": "Enciéndela y cierra su app del teléfono.",
    "Scan for lamps": "Buscar lámparas",
    "Disconnect": "Desconectar",
    "Light studio": "Estudio de luz",
    "Lamp controls": "Controles de la lámpara",
    // Animation panel
    "Animation": "Animación",
    "Ready": "Lista",
    "Illustrated effect preview": "Vista previa ilustrada del efecto",
    "Illustrated preview": "Vista previa ilustrada",
    "Pause animation": "Pausar animación",
    "Resume animation": "Reanudar animación",
    "Pause": "Pausar",
    "Resume": "Reanudar",
    "Selected effect": "Efecto seleccionado",
    "Apply effect": "Aplicar efecto",
    // Light panel
    "Light": "Luz",
    "Power": "Encendido",
    "On": "Encender",
    "Off": "Apagar",
    "Brightness": "Brillo",
    "Dim": "Tenue",
    "Bright": "Intenso",
    "Speed": "Velocidad",
    "Slow": "Lenta",
    "Fast": "Rápida",
    "Solid color": "Color fijo",
    "Whole-lamp color": "Color de toda la lámpara",
    "Whole lamp": "Toda la lámpara",
    "Apply": "Aplicar",
    // Catalog
    "Presets": "Ajustes guardados",
    "+ Add custom preset": "+ Añadir ajuste personalizado",
    "Preset library": "Biblioteca de ajustes",
    "Default": "Predeterminados",
    "Custom": "Personalizados",
    "Search effects": "Buscar efectos",
    "Search by name, color or number": "Buscar por nombre, color o número",
    "Effect category": "Categoría de efecto",
    "Built-in programs": "Programas integrados",
    "Show more effects": "Mostrar más efectos",
    "Animations illustrate each effect family. The lamp renders its own fixed patterns and colors.":
      "Las animaciones ilustran cada familia de efectos. La lámpara muestra sus propios patrones y colores fijos.",
    "Approximate recall": "Reproducción aproximada",
    "Saved frame presets": "Ajustes de fotogramas guardados",
    "All": "Todos",
    "Classic": "Clásicos",
    "Curtain": "Cortina",
    "Transitions": "Transiciones",
    "Water": "Agua",
    "Flow": "Flujo",
    "Trails": "Estelas",
    "Forward": "Avance",
    "Reverse": "Retroceso",
    "{count} program": "{count} programa",
    "{count} programs": "{count} programas",
    "Preview {name}": "Previsualizar {name}",
    "No matching effects. Try another color or name.": "No hay efectos que coincidan. Prueba otro color o nombre.",
    "No matching effects": "No hay efectos que coincidan",
    "Program {id}": "Programa {id}",
    // Preset dialog
    "Add custom preset": "Añadir ajuste personalizado",
    "Edit custom preset": "Editar ajuste personalizado",
    "Close preset editor": "Cerrar editor de ajustes",
    "Choose an effect and speed, then capture a frame.": "Elige un efecto y una velocidad, y luego captura un fotograma.",
    "Effect to capture": "Efecto a capturar",
    "Capture speed": "Velocidad de captura",
    "Illustrated capture effect preview": "Vista previa ilustrada de la captura",
    "Pause capture": "Pausar captura",
    "Start capture": "Iniciar captura",
    "Capture again": "Capturar de nuevo",
    "Ready when you are": "Lista cuando quieras",
    "Preset name": "Nombre del ajuste",
    "Midnight glow": "Brillo de medianoche",
    "Pause after (seconds)": "Pausar después de (segundos)",
    "Approximate recall · speed saved with your preset": "Reproducción aproximada · la velocidad se guarda con el ajuste",
    "Cancel": "Cancelar",
    "Save preset": "Guardar ajuste",
    "Update preset": "Actualizar ajuste",
    "Developed by biryukovlex": "Desarrollado por biryukovlex",
    // Dynamic state
    "Bluetooth link active. Ready to send controls.": "Enlace Bluetooth activo. Lista para recibir controles.",
    "Power it on, keep it nearby, and close its phone app.": "Enciéndela, mantenla cerca y cierra su app del teléfono.",
    "Working…": "Procesando…",
    "Not connected": "Sin conexión",
    "Starting…": "Iniciando…",
    "Paused": "En pausa",
    "Playing": "Reproduciendo",
    "Capture · {seconds} s": "Captura · {seconds} s",
    "Starting at {speed}%…": "Iniciando al {speed}%…",
    "Pause when you find your frame": "Pausa cuando encuentres tu fotograma",
    "Frame held · ready to save": "Fotograma fijado · listo para guardar",
    "Capture ended · start again": "Captura terminada · vuelve a empezar",
    "Connect your lamp to capture": "Conecta tu lámpara para capturar",
    "Saved timing · edit or capture again": "Tiempo guardado · edítalo o captura de nuevo",
    "Program: {name} · {speed}% speed": "Programa: {name} · velocidad {speed}%",
    "Replay": "Reproducir",
    "Replay {name}": "Reproducir {name}",
    "Edit": "Editar",
    "Edit {name}": "Editar {name}",
    "Delete": "Eliminar",
    "Delete {name}": "Eliminar {name}",
    "No custom presets yet. Add one to capture your first frame.": "Aún no hay ajustes personalizados. Añade uno para capturar tu primer fotograma.",
    "No devices found. Check Bluetooth permission and close the phone app, then scan again.":
      "No se encontraron dispositivos. Revisa que el Bluetooth esté activo y cierra la app del teléfono; luego busca de nuevo.",
    "Connect to {name}": "Conectar a {name}",
    "Other Bluetooth devices ({count})": "Otros dispositivos Bluetooth ({count})",
    // Progress and results
    "Pausing capture…": "Pausando captura…",
    "Capture paused.": "Captura en pausa.",
    "Starting preset…": "Iniciando ajuste…",
    "Replaying at {speed}%. Pause will happen automatically.": "Reproduciendo al {speed}%. La pausa se hará automáticamente.",
    "Deleting preset…": "Eliminando ajuste…",
    "Preset deleted.": "Ajuste eliminado.",
    "Connecting to {name}…": "Conectando a {name}…",
    "Connected.": "Conectada.",
    "Scanning nearby Bluetooth devices…": "Buscando dispositivos Bluetooth cercanos…",
    "Scan finished. Select your lamp.": "Búsqueda terminada. Selecciona tu lámpara.",
    "Reconnecting to your saved lamp…": "Reconectando con tu lámpara guardada…",
    "Connected to your saved lamp.": "Conectada a tu lámpara guardada.",
    "Disconnecting…": "Desconectando…",
    "Disconnected.": "Desconectada.",
    "Sending lamp control…": "Enviando control a la lámpara…",
    "Applied.": "Aplicado.",
    "Resuming…": "Reanudando…",
    "Pausing…": "Pausando…",
    "Resumed.": "Reanudada.",
    "Paused.": "En pausa.",
    "Sending built-in effect…": "Enviando efecto integrado…",
    "Effect applied.": "Efecto aplicado.",
    "Starting capture…": "Iniciando captura…",
    "Running at {speed}%. Pause when you find your frame.": "En marcha al {speed}%. Pausa cuando encuentres tu fotograma.",
    "Frame held. Give it a name and save.": "Fotograma fijado. Ponle un nombre y guárdalo.",
    "Saving preset…": "Guardando ajuste…",
    "Preset saved locally.": "Ajuste guardado en este equipo.",
    "Cannot reach the local app: {error}. Keep the launcher running, then reload.":
      "No se puede contactar con la app local: {error}. Mantén abierto el lanzador y recarga la página.",
    "Local server is unavailable. Restart the launcher and reload.": "El servidor local no está disponible. Reinicia el lanzador y recarga la página.",
    "The lamp request failed.": "La petición a la lámpara falló.",
    // SignalRGB sync
    "SignalRGB sync": "Sincronización con SignalRGB",
    "Off. Turn it on to let SignalRGB effects color the whole lamp.":
      "Desactivada. Actívala para que los efectos de SignalRGB coloreen toda la lámpara.",
    "Bluetooth link lost. Reconnecting to your lamp…": "Se perdió la conexión Bluetooth. Reconectando con tu lámpara…",
    "Live. SignalRGB is coloring the lamp.": "En vivo. SignalRGB está coloreando la lámpara.",
    "Waiting for SignalRGB. Install the Lotus Lamp plugin and apply an effect.":
      "Esperando a SignalRGB. Instala el plugin Lotus Lamp y aplica un efecto.",
    "{received} received · {sent} sent to lamp · max {rate}/s": "{received} recibidos · {sent} enviados a la lámpara · máx. {rate}/s",
    "0 received · 0 sent to lamp": "0 recibidos · 0 enviados a la lámpara",
    "SignalRGB sync turned off because you used a manual control.":
      "La sincronización con SignalRGB se desactivó porque usaste un control manual.",
    "Starting SignalRGB sync…": "Activando la sincronización con SignalRGB…",
    "Stopping SignalRGB sync…": "Desactivando la sincronización con SignalRGB…",
    "SignalRGB sync on.": "Sincronización con SignalRGB activada.",
    "SignalRGB sync off.": "Sincronización con SignalRGB desactivada.",
    "SignalRGB sync must be true or false.": "La sincronización con SignalRGB debe ser verdadera o falsa.",
    "SignalRGB receiver is not running.": "El receptor de SignalRGB no está en marcha.",
    // Server messages (lotus_lamp/app.py, lotus_lamp/presets.py)
    "Connect to your lamp first.": "Primero conecta tu lámpara.",
    "Timed playback failed. Reconnect before trying again; it was not replayed.":
      "La reproducción temporizada falló. Reconecta antes de intentarlo de nuevo; no se reprodujo.",
    "Select a device from the scan or reconnect your saved lamp.": "Selecciona un dispositivo de la búsqueda o reconecta tu lámpara guardada.",
    "Scan again so this device can be selected.": "Busca de nuevo para poder seleccionar este dispositivo.",
    "Use a lamp name between 1 and 100 characters.": "Usa un nombre de lámpara de 1 a 100 caracteres.",
    "The lamp did not complete its Bluetooth connection.": "La lámpara no completó la conexión Bluetooth.",
    "This device does not expose the supported Lotus Lamp control service. No commands were sent.":
      "Este dispositivo no ofrece el servicio de control Lotus Lamp compatible. No se envió ningún comando.",
    "Connected, but could not save this device. Select it again next time.":
      "Conectada, pero no se pudo guardar este dispositivo. Selecciónalo de nuevo la próxima vez.",
    "Power must be true or false.": "El encendido debe ser verdadero o falso.",
    "Hold must be true or false.": "La pausa debe ser verdadera o falsa.",
    "Choose a valid six-digit RGB color.": "Elige un color RGB válido de seis dígitos.",
    "Unknown lamp command.": "Comando de lámpara desconocido.",
    "Use the local app URL.": "Usa la dirección local de la app.",
    "Only the local app can control the lamp.": "Solo la app local puede controlar la lámpara.",
    "Use the local app controls.": "Usa los controles de la app local.",
    "Invalid JSON request.": "Petición JSON no válida.",
    "Request must be a JSON object.": "La petición debe ser un objeto JSON.",
    "Bluetooth operation timed out. Move closer and reconnect.": "La operación Bluetooth tardó demasiado. Acércate y vuelve a conectar.",
    "This preset no longer exists. Refresh and try again.": "Este ajuste ya no existe. Recarga e inténtalo de nuevo.",
    "You can save up to 100 presets. Delete one to make room.": "Puedes guardar hasta 100 ajustes. Elimina uno para hacer sitio.",
    "Give the preset a name from 1 to 80 characters.": "Ponle al ajuste un nombre de 1 a 80 caracteres.",
    "Preset program must be an integer from 0 to 212.": "El programa del ajuste debe ser un número entero de 0 a 212.",
    "Pause time must be from 0 to 600 seconds, in whole milliseconds.": "El tiempo de pausa debe estar entre 0 y 600 segundos, en milisegundos enteros.",
    "Preset speed must be an integer from 0 to 100.": "La velocidad del ajuste debe ser un número entero de 0 a 100.",
    "Custom spatial flow needs a verified pixel/palette command. This controller currently exposes only fixed effects. No commands were sent.":
      "El flujo espacial personalizado necesita un comando de píxeles/paleta verificado. Este controlador solo ofrece efectos fijos. No se envió ningún comando.",
    "Segment commands are not documented for this controller. The segment design is a preview only; no commands were sent.":
      "Los comandos por segmentos no están documentados para este controlador. El diseño por segmentos es solo una vista previa; no se envió ningún comando.",
  };

  // Server messages that embed values.
  const esPatterns = [
    [/^(.+) must be an integer from (\d+) to (\d+)\.$/, (m, label, a, b) =>
      `${es[label] || label} debe ser un número entero de ${a} a ${b}.`],
    [/^Bluetooth operation failed: (.*)\. Check Bluetooth permission, keep the lamp nearby, and close its phone app\.$/s, (m, detail) =>
      `La operación Bluetooth falló: ${detail}. Revisa que el Bluetooth esté activo, mantén la lámpara cerca y cierra su app del teléfono.`],
    [/^Could not load saved device: (.*)\. Scan to select it again\.$/s, (m, detail) =>
      `No se pudo cargar el dispositivo guardado: ${detail}. Busca de nuevo para seleccionarlo.`],
    [/^Could not load presets: (.*)\. The original file has been preserved\.$/s, (m, detail) =>
      `No se pudieron cargar los ajustes: ${detail}. El archivo original se ha conservado.`],
    [/^SignalRGB port (\d+) is unavailable: (.*)\. Close the other program using it and restart the app\.$/s, (m, port, detail) =>
      `El puerto ${port} de SignalRGB no está disponible: ${detail}. Cierra el otro programa que lo usa y reinicia la app.`],
  ];
  // Labels passed to the server's integer() check.
  Object.assign(es, {"Program": "Programa", "Pause time (ms)": "Tiempo de pausa (ms)", "Resume speed": "Velocidad al reanudar", "Mode": "Modo"});

  const languages = {en: {name: "English"}, es: {name: "Español", strings: es, patterns: esPatterns}};
  const STORAGE_KEY = "lotus-language";

  function detect() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && languages[saved]) return saved;
    } catch { /* Storage can be unavailable; fall back to the browser language. */ }
    const preferred = (typeof navigator !== "undefined" && (navigator.languages?.[0] || navigator.language)) || "en";
    return preferred.toLowerCase().startsWith("es") ? "es" : "en";
  }

  const current = detect();

  function t(text, vars) {
    if (typeof text !== "string") return text;
    const pack = languages[current];
    let result = pack.strings?.[text];
    if (result === undefined && pack.patterns) {
      for (const [pattern, replace] of pack.patterns) {
        if (pattern.test(text)) { result = text.replace(pattern, replace); break; }
      }
    }
    if (result === undefined) result = text;
    return vars ? result.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match)) : result;
  }

  // Translate the static page: text nodes plus accessible labels and placeholders.
  function translatePage() {
    document.documentElement.lang = current;
    document.title = t(document.title);
    if (current === "en") return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const trimmed = node.nodeValue.trim();
      if (!trimmed) continue;
      const translated = t(trimmed);
      if (translated !== trimmed) node.nodeValue = node.nodeValue.replace(trimmed, translated);
    }
    for (const attribute of ["aria-label", "placeholder", "title"]) {
      document.querySelectorAll(`[${attribute}]`).forEach((element) => {
        element.setAttribute(attribute, t(element.getAttribute(attribute)));
      });
    }
  }

  function setupPicker(select) {
    if (!select) return;
    for (const [code, info] of Object.entries(languages)) {
      const option = document.createElement("option");
      option.value = code; option.textContent = info.name;
      select.append(option);
    }
    select.value = current;
    select.onchange = () => {
      try { localStorage.setItem(STORAGE_KEY, select.value); } catch { /* Not persisted; still switch now. */ }
      location.reload();
    };
  }

  globalThis.LotusI18n = {t, translatePage, setupPicker, language: current};
})();
