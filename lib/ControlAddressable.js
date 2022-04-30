const mergeOptions = require('merge-options');

const ControlBase = require("./ControlBase");
// just for type hints:
const { AddressableMultiColorModeBase } = require("./AddressableMultiColorMode");
const { AddressableCustomModeStep } = require("./AddressableCustomModeStep");

/**
 * @typedef {object} QueryResponseAddressable
 * @property {number} type
 * @property {boolean} on
 * @property {string} mode
 * @property {any} effect Can be a number or a string
 * @property {number} speed
 * @property {object} color
 * @property {number} color.red
 * @property {number} color.green
 * @property {number} color.blue
 * @property {number} warm_white
 */

/**
 * @typedef {object} ConfigResponseAddressable
 * @property {number} pixel_count
 * @property {number} segments
 * @property {string} ic_type
 * @property {string} led_order
 * @property {number} pixel_count_music
 * @property {number} segments_music
 */

// taken directly from https://github.com/Danielhiversen/flux_led/blob/master/flux_led/protocol.py
const IC_TYPE_MAP = {
	1: "WS2812B",
	2: "SM16703",
	3: "SM16704",
	4: "WS2811",
	5: "UCS1903",
	6: "SK6812",
	7: "SK6812RGBW",
	8: "INK1003",
	9: "UCS2904B",
};

// taken directly from https://github.com/Danielhiversen/flux_led/blob/master/flux_led/protocol.py
const ADDRESSABLE_RGB_NUM_TO_WIRING = {
    0: "RGB",
    1: "RBG",
    2: "GRB",
    3: "GBR",
    4: "BRG",
    5: "BGR",
};

// taken directly from https://github.com/Danielhiversen/flux_led/blob/master/flux_led/protocol.py
const ADDRESSABLE_RGBW_NUM_TO_WIRING = {
    0: "RGBW",
    1: "RBGW",
    2: "GRBW",
    3: "GBRW",
    4: "BRGW",
    5: "BGRW",
    6: "WRGB",
    7: "WRBG",
    8: "WGRB",
    9: "WGBR",
    10: "WBRG",
    11: "WBGR",
};

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, Math.round(value)));
}

function determineMode(data) {
	const byte3 = data.readUInt8(3);
	const byte4 = data.readUInt8(4);

	switch(byte3) {
		case 0x61:
			return { mode: "fixed", effect: byte4 };
		case 0x25:
			return { mode: "rbm", effect: byte4 };
		case 0x60:
			return { mode: "custom", effect: null };
		case 0x24:
			const EFFECT_MAP_INVERSE = {
				1: "static",
				2: "running_water",
				3: "strobe",
				4: "jump",
				5: "breathing",
			};
			return { mode: "multi", effect: EFFECT_MAP_INVERSE[byte4] };
		case 0x62:
			return { mode: "music", effect: null };
		default:
			return { mode: null, effect: null };
	}
}

class ControlAddressable extends ControlBase {
	/**
	 * Create a new ControlAddressable instance. This does not connect to the controller yet.
	 * @param {String} address IP or hostname of the controller
	 * @param {Object} options 
	 * @param {boolean} option.log_all_received Print all received bytes into stdout for debug purposes (Default: false)
	 * @param {Number} options.connect_timeout Duration in milliseconds after which the connection attempt will be cancelled if the connection can not be established (Default: null [No timeout])
	 * @param {Number} options.command_timeout Duration in milliseconds after which an acknowledged command will be regarded as failed. Set to null to disable. (Default: 1000)
	 */
    constructor(address, options = {}) {
        const merged_options = mergeOptions({
			log_all_received: false,
			connect_timeout: null,
			command_timeout: 1000,
		}, options);

		super(address, 
			merged_options.command_timeout, 
			merged_options.connect_timeout,
			merged_options.log_all_received
		);

		this._options = merged_options;

        this._sequenceNumber = 0;
    }

    /**
	 * Sets the power state either to on or off
	 * @param {Boolean} on 
	 * @returns {Promise<boolean>}
	 */
	setPower(on) {
		let cmd_buf = Buffer.from([0x71, (on) ? 0x23 : 0x24, 0x0f]);

		const promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, false, resolve, reject);
		}).then(() => true);

		return promise;
	}

	/**
	 * Convenience method to call setPower(true)
	 * @returns {Promise<boolean>}
	 */
	turnOn() {
		return this.setPower(true);
	}

	/**
	 * Convenience method to call setPower(false)
	 * @returns {Promise<boolean>}
	 */
	turnOff() {
		return this.setPower(false);
	}

    /**
	 * Queries the controller for its current state
	 * @returns {Promise<QueryResponseAddressable>}
	 */
	queryState() {
		const cmd_buf = Buffer.from([0x81, 0x8a, 0x8b]);

		const promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, true, resolve, reject);
		}).then(data => {
			if(data.length < 14) {
				throw new Error("Response was too short");
			}

            const mode = determineMode(data);

			const state = {
				type: data.readUInt8(1),
				on: (data.readUInt8(2) == 0x23),
				mode: mode.mode,
				effect: mode.effect,
				speed: data.readUInt8(5),
				color: {
					red: data.readUInt8(6),
					green: data.readUInt8(7),
					blue: data.readUInt8(8)
				},
				warm_white: data.readUInt8(9),
			};

			return state;
		});

		return promise;
	}

	/**
	 * Queries the controller for its current config i.e. the number of LEDs, the type of LEDs, etc
	 * @returns {Promise<ConfigResponseAddressable>}
	 */
	queryDeviceConfig() {
		const cmd_buf = Buffer.from([ 0x63, 0x12, 0x21, 0x36 ]);

		const promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, true, resolve, reject);
		}).then(data => {
			if(data.length < 11) {
				throw new Error("Response was too short");
			}

			if (data.readUInt8(0) !== 0 || data.readUInt8(1) !== 0x63) {
				throw new Error("Invalid response received (might be the wrong protocol version?");
			}

			const ic_type_num = data.readUInt8(6);

			let wiring_map = ADDRESSABLE_RGB_NUM_TO_WIRING;
			if (ic_type_num == 7) {
				wiring_map = ADDRESSABLE_RGBW_NUM_TO_WIRING;
			}

			const config = {
				pixel_count: data.readUInt16BE(2),
				segments: data.readUInt8(5),
				ic_type: IC_TYPE_MAP[ic_type_num],
				led_order: wiring_map[data.readUInt8(7)],
				pixel_count_music: data.readUInt8(8),
				segments_music: data.readUInt8(9),
			};

			return config;
		});

		return promise;
	}

	/**
	 * Set the fixed mode of the controller
	 * @param {Object} options 
	 * @param {number} option.effect The effect to set from 1-10 (1 = static)
	 * @param {number} option.speed The speed of the effect from 1-100
	 * @param {number} option.foreground.red Red component of the foreground color
	 * @param {number} option.foreground.green Green component of the foreground color
	 * @param {number} option.foreground.blue Blue component of the foreground color
	 * @param {number} option.background.red Red component of the background color
	 * @param {number} option.background.green Green component of the background color
	 * @param {number} option.background.blue Blue component of the background color
	 * @param {boolean} option.reversed Reverse the effect direction
	 * @returns {Promise<boolean>}
	 */
    setFixedMode(options = {}) {
		const o = mergeOptions({
			effect: 1,
			speed: 50,
			foreground: { red: 0, green: 0, blue: 0 },
			background: { red: 0, green: 0, blue: 0 },
			reversed: false,
		}, options);

		let byte20 = (o.reversed) ? 0x01 : 0x00;

		if (o.effect == 1 || o.effect == 7 || o.effect == 8) { // these are not reversible
			byte20 = 0xff;
		}

		const cmd_buf = Buffer.from([
			0xb0, 0xb1, 0xb2, 0xb3, 0x00, 0x01, 0x01,
			(this._sequenceNumber++) & 0xff,
			0x00, 0x0d, // <-- remaining buffer length (16 bit)
            0x41, // <-- command
			clamp(o.effect, 1, 10),
			clamp(o.foreground.red, 0, 255), 
            clamp(o.foreground.green, 0, 255), 
            clamp(o.foreground.blue, 0, 255),
            clamp(o.background.red, 0, 255), 
            clamp(o.background.green, 0, 255), 
            clamp(o.background.blue, 0, 255),
			clamp(o.speed, 0, 100),
			byte20,
			0x00, 0x00,
			0x00
		]);

		const promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, false, resolve, reject);
		}).then(() => true);

		return promise;
	}

	/**
	 * Convenice method to set a static color with less code
	 * @param {number} red 
	 * @param {number} green 
	 * @param {number} blue
	 * @returns {Promise<boolean>}
	 */
	setColor(red, green, blue) {
		return this.setFixedMode({
			effect: 1,
			foreground: { red, green, blue },
		});
	}

	/**
	 * Set the "Rbm" mode (not sure what that means exactly)
	 * @param {number} mode Effect between 1 and 100
	 * @param {number} brightness Brightness of the LEDs between 1 and 100
	 * @param {number} speed Speed of the effect between 0 and 100 (0 = static)
	 * @returns {Promise<boolean>}
	 */
    setRbmMode(mode, brightness = 50, speed = 50) {
        const cmd_buf = Buffer.from([
            0xb0, 0xb1, 0xb2, 0xb3, 0x00, 0x01, 0x01,
			(this._sequenceNumber++) & 0xff,
            0x00, 0x05, // <-- remaining buffer length (16 bit)
            0x42, // <-- command
            clamp(mode, 1, 100),
            clamp(speed, 0, 100),
            clamp(brightness, 1, 100),
            0x00,
        ]);

		const promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, false, resolve, reject);
		}).then(() => true);

		return promise;
    }

	/**
	 * Set a multi color mode (or individually addressable mode)
	 * @param {AddressableMultiColorModeBase} modeDefiniton 
	 * @returns {Promise<boolean>}
	 */
    setMultiColorMode(modeDefiniton) {
        const colorArray = modeDefiniton._getColors().flat().map(c => clamp(c, 0, 255));

        const buffer_len = modeDefiniton._length * 3 + 6 + 3;
        const len_upper = (buffer_len & 0xff00) >> 16;
        const len_lower = (buffer_len & 0xff);

        const cmd_buf = Buffer.from([
            0xb0, 0xb1, 0xb2, 0xb3, 0x00, 0x01, 0x01,
            (this._sequenceNumber++) & 0xff,
            len_upper, len_lower,
            0x59, // <-- command
            len_upper, len_lower,
            ...colorArray,
            0x00,
            modeDefiniton._length,
            modeDefiniton._effect,
            modeDefiniton._speed,
            0x00, 0x00
        ]);

        const promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, false, resolve, reject);
		}).then(() => true);

		return promise;
    }

	/**
	 * Set a custom mode (i.e. a series of effects that play one after another)
	 * @param {AddressableCustomModeStep[]} steps An array of steps
	 * @returns {Promise<boolean>}
	 */
	setCustomMode(steps) {
		if (steps.length > 32) {
			return Promise.reject(new Error("Too many steps were specified"));
		} 

		const all_steps = new Array(32).fill([0,0,0,0,0,0,0,0,0,0]);

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i];

			let last_bit = 0;
			last_bit |= (step._segmentation) ? 0x80 : 0;
			last_bit |= (step._leftDirection) ? 0x01 : 0;

			all_steps[i] = [
				0xf0,
				step._effect,
				clamp(step._speed, 0, 100),
				clamp(step._foreground.red, 0, 255),
				clamp(step._foreground.green, 0, 255),
				clamp(step._foreground.blue, 0, 255),
				clamp(step._background.red, 0, 255),
				clamp(step._background.green, 0, 255),
				clamp(step._background.blue, 0, 255),
				last_bit,
			];
		}

		const cmd_buf = Buffer.from([
			0xb0, 0xb1, 0xb2, 0xb3, 0x00, 0x01, 0x01,
			(this._sequenceNumber++) & 0xff,
			0x01, 0x42, // <-- command length (16 bit)
			0x51, // <-- command
			...all_steps.flat(),
			0x00,
		]);

		const promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, false, resolve, reject);
		}).then(() => true);

		return promise;
	}
}

module.exports = ControlAddressable;