// Lotus Lamp bridge for SignalRGB.
// Sends the whole-lamp color over loopback UDP to Lotus Light Studio
// (python -m lotus_lamp.app), which forwards it to the lamp over Bluetooth LE.
// Install: copy this folder to Documents\WhirlwindFX\Plugins\LotusLamp and restart SignalRGB.
import udp from "@SignalRGB/udp";

/* global
controller:readonly
discovery:readonly
service:readonly
device:readonly
LightingMode:readonly
forcedColor:readonly
shutdownColor:readonly
shutdownAction:readonly
*/

export function Name() { return "Lotus Lamp"; }
export function Version() { return "1.2.0"; }
export function Type() { return "network"; }
export function Publisher() { return "Lotus Light Studio"; }
export function Size() { return [1, 1]; }
export function DefaultPosition() { return [140, 90]; }
export function DefaultScale() { return 8.0; }
export function LedNames() { return ["Lamp"]; }
export function LedPositions() { return [[0, 0]]; }
export function SubdeviceController() { return false; }
export function ControllableParameters() {
	return [
		{"property":"LightingMode", "group":"lighting", "label":"Lighting Mode", "description":"Canvas follows the active effect; Forced uses a fixed color", "type":"combobox", "values":["Canvas", "Forced"], "default":"Canvas"},
		{"property":"forcedColor", "group":"lighting", "label":"Forced Color", "min":"0", "max":"360", "type":"color", "default":"#009bde"},
		{"property":"shutdownAction", "group":"lighting", "label":"Shutdown Action", "description":"What the lamp does when SignalRGB closes, the PC shuts down or sleeps. It turns back on with the next effect color", "type":"combobox", "values":["Turn lamp off", "Use Shutdown Color"], "default":"Turn lamp off"},
		{"property":"shutdownColor", "group":"lighting", "label":"Shutdown Color", "description":"Used when Shutdown Action is 'Use Shutdown Color'", "min":"0", "max":"360", "type":"color", "default":"#000000"},
	];
}

// Packets (see lotus_lamp/signalrgb.py):
//   color       "LOTUS" | 1 | R | G | B
//   power off   "LOTUS" | 1 | 0x00
//   final color "LOTUS" | 1 | 0x01 | R | G | B   (Shutdown Color)
const HEADER = [0x4C, 0x4F, 0x54, 0x55, 0x53, 0x01];
const CMD_POWER_OFF = 0x00;
const CMD_FINAL_COLOR = 0x01;
const DEFAULT_PORT = 8421;
const KEEPALIVE_MS = 1000; // Resend an unchanged color once per second so the app shows "receiving".
const CONTROLLER_ID = "lotus-lamp-local";
// App logo (512x512 PNG), drawn by lotus_lamp.desktop.make_icon. Embedded so no download is needed.
const LOGO = "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAKz0lEQVR42u3dMVIUaxiF4dNfQBUh7Gl2Q2DgMgwM2A17YkKqSDAx0ypRobr7P88T38BpnDlv/z1yt7Cc25u7N1cB+Egvr9fNVViLH6iBBxAIAgBDDyAMBAAGH0AQCAAMPoAgEAAYfABBIAAw+gBiQAAYfQDEgAAw/AAIAQFg9AEQAwLA8AMgBASA0QdADAgAww+AEBAAhh8AISAADD8AQkAAGH4AhMAfjUtg/AF81jsB8JcBAKcBAsDwAyAE4hGA8QfAJjgB8EMGwGmAADD8AAiBeARg/AGwHQLADxAAGxKPAPzQAIhHAk4AjD8AtkUA+AEBYGPiEYDhByAeCTgBMP4A2J7KADD+ANigsgAw/gDYovR8B8DwAxDfC+g6ATD+ANiosgAw/gDYqrIAMP4AiICyADD+AIiAsgAw/gCIgLIAMP4AiICyADD+AIiAsgAw/gCIgLIAMP4AiICyADD+AIiAsgAw/gCIgLIAMP4AiICyADD+AIgAXwIEAFYPAHf/ADgF2G8Lx/gDQF8EjPEHgL4IGOMPAH0R4EuAABBfAnT3DwAFpwBj/AGgLwLG+ANAXwT4DgAAxHcA3P0DQMEpwBh/AOiLgDH+ANAXAb4DAADxHQB3/wBQcArgBAAAnAC4+weAhlOAMf4A0BcBHgEAQDwCcPcPAAWnAE4AAMAJgLt/AGg4BRjjDwB9EeARAADEIwB3/wBQcArgBAAAnAC4+weAhlMAJwAA4ATA3T8ANJwCOAEAACcA7v4BoOEUwAkAADgBAAAEQBz/A0AWfAzgBAAACm3u/qHD0+Pzu//by8O9CwYn9vJ63QQAGPz/JghAAAAloy8GoDwAjD8YfiEA60WAAADDLwSgMADG+IPxX+HPAfzdhm8CAAy/0wDoOwXwewDA+DsNgPhNgO7+wbiKAMj6jwGcAIBRFQHgBAAwpiIAagPA8T8YUX9+yNKPAZwAgPH0OsAJAGA0vR4QAABARwB4/g/ulr0uyPLfA3ACAEbS6wMnAACAAADcHXudsH4AeP4PAKn4HoATAHBX7PWCRwAAgAAAANYOAM//IY7DvW5Iy/cAnAAAgEcAAIAAAAAEABDPwb1+EAAAwIkDwL8AAIBU/UsAJwAA4BEAACAAAAABAAAIAABAAAAAAgAAOG4A+B0AAJC63wXgBAAAPAIAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQCHdXm49/oBAQAACAAAQAAAAAIA4jm41w0IAABAAAAAAgDiONzrBQQAAAgAwF2x1wkCAAAQAIC7Y68PBABgJL0uEAAAgAAA3C27+wcBALSPpvEHAQCUjafxBwEAlI2o8QcBAJSNqfEHAQCUjarxBwEAlI2r8Yfz2JLk9ubuzaWAc3l6fDb8wD95eb1uTgDAaYDxBycAgNMAww8NJwACAISA4QcBAIgBow8CANjNl8u3ZV7L96evfqAgAMBoIyZAAIBBRzDAPgEgAjDsCAWhQM/4Jz//GaAAwMCDQEAAgJEHcYAAAEMPwgABAMYeRAECAIw9iAJOHAAiAIMPgoCO8RcAGHwQBAgAAYDBB0GAAACjD2KAjgAQARh9EAOsP/4CAMMPQgABIAAw/CAEEAAYfsMPQoCeABABGH4QAqw9/kkyLgvGH7y/6SMA8OEA3ucIAHwoAN7v1AbA754V4MMA8L4nSzz/dwKADwHw/scJAABQHwAeAwBAljz+dwIAAE4AAAABEI8B4jeDAd7/ZL3jfycA+BAA73ucADgF8GEAeL/TcPfvBAAfCuB9jhMA8OEA3t+0ePfxvv9FcPyWMMDwkxWO/wUAQgAMPwJABCAEwPDTMP4CACEAhh8BIAAQA2D0EQAiADEARp8lx18AIAjA4CMARACCAAw+DeMvABAEYPARACIAUQDGnobxFwCIAjD2CAARgDAAQ0/D+AsAxAEYeQSACEAgYOChYfw/JABEAEIBww7nGn8BAILBoIMAEAEgJow2NIy/AACA0gCYo/2BAIDP39o56h8MAPi8jR2XFAD6zNELBQDc/X/8tjoBAAAnAE4BAGD1u/9PPQEQAQBw3C2ds/7BAcD4+w4AAHCkAHAKAADH285Z5YUAgPE/4CMAEQAAx9lK3wEAgPgOgFMAAFj87n+XEwARAAD7b+O0vFAAMP4H+A6ACADA+O+3hb4ECADxJUCnAABQsIHTfgEAoHH7xoUAgL7NGxcEAPq2blwYAOjbuHGBAKBv28aFAoC+TRsXDAD6tmxcOADo27BxAQGgb7vGhQSAvs0aFxQA+rZqXFgA6Nuo0w7q7c3dm79uABj+sv8dsNMAAGxRYQCIAABsUGkAiAAAbE+6vgMQ3wsAwPD3ngA4DQDAxpQHgAgAwLak7xFAPBIAwPB3ngA4DQDAhpQHgAgAwHak7xFAPBIAwPALACEAgNPidDwC8IMGwCY4AXAaAICbQQEgBAAMf6dxCfyFAPBZ7wQApwEAhl8ACAFXAcDwCwAhAIDhFwBCAADDLwDEAABGXwAIAQAMvwAQAwAYfQEgBAAw/AJADABg9AWAGAAw+ggAQQBg8BEAggDA4CMABAGAwUcACAMAQ48AEAgABp5f/AAllbu7L8TwsQAAAABJRU5ErkJggg==";

let socket;
let lastColor = null;
let lastSentAt = 0;

function hexToRgb(hex) {
	const value = parseInt(hex.replace("#", ""), 16);
	return [(value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
}

function send(color) {
	socket.write(HEADER.concat(color), controller.ip, controller.port);
	lastColor = color;
	lastSentAt = Date.now();
}

export function Initialize() {
	device.setName(controller.name);
	device.setImageFromBase64(LOGO);
	socket = udp.createSocket();
	device.log(`Lotus Lamp: sending to ${controller.ip}:${controller.port}`);
}

export function Render() {
	const color = LightingMode === "Forced" ? hexToRgb(forcedColor) : device.color(0, 0);
	const changed = lastColor === null || color[0] !== lastColor[0] || color[1] !== lastColor[1] || color[2] !== lastColor[2];

	// The app limits BLE writes to 15/s and drops duplicates; skipping repeats here only saves UDP traffic.
	if(changed || Date.now() - lastSentAt >= KEEPALIVE_MS) {
		send(color);
	}
}

export function Shutdown(SystemSuspending) {
	// Runs when SignalRGB exits, Windows shuts down or the PC sleeps (SystemSuspending).
	const packet = shutdownAction === "Use Shutdown Color"
		? HEADER.concat([CMD_FINAL_COLOR], hexToRgb(shutdownColor))
		: HEADER.concat([CMD_POWER_OFF]);
	socket.write(packet, controller.ip, controller.port);
	device.log(`Lotus Lamp: shutdown (${SystemSuspending ? "sleep" : "exit"}), ${shutdownAction}`);
	socket.close();
}

// -------------------------------------------<( Discovery Service )>--------------------------------------------------
// The app only listens on 127.0.0.1, so there is nothing to scan for: one local controller is
// announced automatically. The UDP port can be changed from the plugin card (Network tab).

export function DiscoveryService() {
	this.announced = false;

	this.Initialize = function() {
		service.log("Lotus Lamp: announcing local bridge");
		this.announce();
	};

	this.Update = function() {
		if(!this.announced) {
			this.announce();
		}
	};

	this.Discovered = function(value) {};

	this.announce = function() {
		const bridge = new LotusBridge();
		service.addController(bridge);
		service.updateController(bridge);
		service.announceController(bridge);
		this.announced = true;
		service.log(`Lotus Lamp: controller ready at ${bridge.ip}:${bridge.port}`);
	};

	this.setPort = function(text) {
		const port = parseInt(text, 10);

		if(!(port >= 1024 && port <= 65535)) {
			service.log(`Lotus Lamp: ignoring invalid port "${text}"`);
			return;
		}

		service.saveSetting("LotusLamp", "port", String(port));
		service.log(`Lotus Lamp: port set to ${port}. Restart SignalRGB to apply it.`);
	};
}

class LotusBridge {
	constructor() {
		const saved = parseInt(service.getSetting("LotusLamp", "port"), 10);
		this.id = CONTROLLER_ID;
		this.name = "Lotus Lamp";
		this.ip = "127.0.0.1";
		this.port = saved >= 1024 && saved <= 65535 ? saved : DEFAULT_PORT;
		this.connected = true;
	}

	update() {}
}
