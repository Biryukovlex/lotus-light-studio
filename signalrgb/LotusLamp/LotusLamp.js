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
*/

export function Name() { return "Lotus Lamp"; }
export function Version() { return "1.0.0"; }
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
		{"property":"shutdownColor", "group":"lighting", "label":"Shutdown Color", "description":"Sent when SignalRGB closes or the PC sleeps", "min":"0", "max":"360", "type":"color", "default":"#000000"},
	];
}

// Packet: "LOTUS" | version 1 | R | G | B  (see lotus_lamp/signalrgb.py)
const HEADER = [0x4C, 0x4F, 0x54, 0x55, 0x53, 0x01];
const DEFAULT_PORT = 8421;
const KEEPALIVE_MS = 1000; // Resend an unchanged color once per second so the app shows "receiving".
const CONTROLLER_ID = "lotus-lamp-local";

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
	send(SystemSuspending ? [0, 0, 0] : hexToRgb(shutdownColor));
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
