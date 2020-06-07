const net = require('net');

const mergeOptions = require('merge-options');

const EffectInterface = require('./EffectInterface');
const CustomMode = require('./CustomMode');

const PORT = 5577;
// some controllers send their responses in multiple chunks, and we only know that we got the full message, if the controller doesn't send something for a while
const RESPONSE_TIMEOUT = 500; // 0.5 sec

const patterns = Object.freeze({
	seven_color_cross_fade: 0x25,
	red_gradual_change: 0x26,
	green_gradual_change: 0x27,
	blue_gradual_change: 0x28,
	yellow_gradual_change: 0x29,
	cyan_gradual_change: 0x2a,
	purple_gradual_change: 0x2b,
	white_gradual_change: 0x2c,
	red_green_cross_fade: 0x2d,
	red_blue_cross_fade: 0x2e,
	green_blue_cross_fade: 0x2f,
	seven_color_strobe_flash: 0x30,
	red_strobe_flash: 0x31,
	green_strobe_flash: 0x32,
	blue_stobe_flash: 0x33,
	yellow_strobe_flash: 0x34,
	cyan_strobe_flash: 0x35,
	purple_strobe_flash: 0x36,
	white_strobe_flash: 0x37,
	seven_color_jumping: 0x38
});

/**
 * @typedef {Object} QueryResponse
 * @property {number} type
 * @property {boolean} on
 * @property {string} mode
 * @property {number} speed
 * @property {object} color
 * @property {number} color.red
 * @property {number} color.green
 * @property {number} color.blue
 * @property {number} warm_white
 * @property {number} cold_white
 */

/*
 * Helper functions
 */
function determineMode(resp) {
	var pattern = resp.readUInt8(3);

	if(pattern == 0x61) {
		return "color";
	} else if (pattern == 0x62) {
		return "special";
	} else if (pattern == 0x60) {
		return "custom";
	} else if (pattern >= 0x25 && pattern <= 0x38) {
		for(let pattern_name in patterns) {
			if(patterns[pattern_name] == pattern) return pattern_name;
		}
	}
}

function delayToSpeed(delay) {
	delay = clamp(delay, 1, 31);
	delay -= 1; //bring into interval [0, 30]
	return 100 - (delay / 30 * 100);
}

function speedToDelay(speed) {
	speed = clamp(speed, 0, 100);
	return (30 - ((speed / 100) * 30)) + 1;
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

class Control {
	/**
	 * Create a new Control instance. This does not connect to the controller, yet.
	 * @param {String} address IP or hostname of the controller
	 * @param {Object} options 
	 * @param {boolean} options.wait_for_reply [Deprecated] Wait for the controllers to send data as acknowledgement. (Default: true)
	 * @param {boolean} options.log_all_received Print all received bytes into stdout for debug purposes (Default: false)
	 * @param {boolean} options.apply_masks Set the mask bit in setColor and setWarmWhite (Default: false)
	 * @param {boolean} options.cold_white_support Send a different version of the color change packets, which also set the cold white values (Default: false)
	 * @param {Number} options.connect_timeout Duration in milliseconds after which the connection attempt will be cancelled if the connection can not be established (Default: null [No timeout])
	 * @param {Object} options.ack
	 * @param {boolean} options.ack.power Wait for controller to send data to achnowledge power change commands (Default: true)
	 * @param {boolean} options.ack.color Wait for controller to send data to achnowledge color change commands (Default: true)
	 * @param {boolean} options.ack.pattern Wait for controller to send data to achnowledge built-in pattern change commands (Default: true)
	 * @param {boolean} options.ack.custom_pattern Wait for controller to send data to achnowledge custom pattern change commands (Default: true)
	 */
	constructor(address, options = {}) {
		this._address = address;

		if ("wait_for_reply" in options) {
			options.ack = (options.wait_for_reply) ? Control.ackMask(0x0F) : Control.ackMask(0);
		}

		this._options = mergeOptions({
			log_all_received: false,
			apply_masks: false,
			ack: {
				power: true,
				color: true,
				pattern: true,
				custom_pattern: true
			},
			connect_timeout: null,
			cold_white_support: false,
		}, options);

		this._commandQueue = [];

		this._socket = null;

		this._receivedData = Buffer.alloc(0);
		this._receiveTimeout = null;
		this._connectTimeout = null;
		this._preventDataSending = false;

		// store the values of the last sent/received values to enable the convenience methods
		this._lastColor = { red: 0, green: 0, blue: 0 };
		this._lastWW = 0;
		this._lastCW = 0;
	}

	static get patternNames() {
		return Object.keys(patterns);
	}

	static ackMask(mask) {
		return {
			power: (mask & 0x01) > 0,
			color: (mask & 0x02) > 0,
			pattern: (mask & 0x04) > 0,
			custom_pattern: (mask & 0x08) > 0
		};
	}

	_receiveData(empty, data) {
		if (empty) {
			// no data, so request is instantly finished
			// this can happend when a command is sent without waiting for a reply or when a timeout is reached
			let finished_command = this._commandQueue[0];

			if(finished_command != undefined) {
				let resolve = finished_command.resolve;
				if(resolve != undefined) {
					resolve(this._receivedData);
				}
			}

			// clear received data
			this._receivedData = Buffer.alloc(0);

			this._commandQueue.shift();

			this._handleNextCommand();
		} else {
			this._receivedData = Buffer.concat([ this._receivedData, data ]);

			if(this._receiveTimeout != null) clearTimeout(this._receiveTimeout);

			// since we don't know how long the response is going to be, set a timeout after which we consider the
			// whole message to be received
			this._receiveTimeout = setTimeout(() => {
				this._receiveData(true);
			}, RESPONSE_TIMEOUT);
		}
	}

	_handleNextCommand() {
		if(this._commandQueue.length == 0) {
			if(this._socket != null) this._socket.end();
			this._socket = null;
		} else {
			let cmd = this._commandQueue[0];

			if(!cmd.expect_reply) {
				this._socket.write(cmd.command, "binary", () => {
					this._receiveData(true);
				});
			} else {
				this._socket.write(cmd.command);
			}
		}
	}

	_sendCommand(buf, expect_reply, resolve, reject) {
		// calculate checksum
		let checksum = 0;
		for (let byte of buf.values()) {
			checksum += byte;
		}
		checksum &= 0xFF;

		// append checksum to command buffer
		let command = Buffer.concat([ buf, Buffer.from( [checksum] ) ]);

		if (this._commandQueue.length == 0 && this._socket == null) {
			this._commandQueue.push({ expect_reply, resolve, reject, command });

			this._preventDataSending = false;

			this._socket = net.connect(PORT, this._address, () => {
				if (this._connectTimeout != null) {
					clearTimeout(this._connectTimeout);
					this._connectTimeout = null;
				}

				if (!this._preventDataSending) { // prevent "write after end" errors
					this._handleNextCommand(); // which is the "first" command in this case
				}
			});

			this._socket.on('error', (err) => {
				this._socketErrorHandler(err, reject);
			});

			this._socket.on('data', (data) => {
				if (this._options.log_all_received) {
					console.log("Received:", data.toString("hex").replace(/(\w{2})/g, "$1 "));
				}
				
				this._receiveData(false, data);
			});

			if (this._options.connect_timeout != null) {
				this._connectTimeout = setTimeout(() => {
					this._socketErrorHandler(new Error("Connection timeout reached"), reject);
				}, this._options.connect_timeout);
			}
		} else {
			this._commandQueue.push({ expect_reply, resolve, reject, command });
		}
	}

	_socketErrorHandler(err, reject) {
		this._preventDataSending = true;

		reject(err);

		if(this._socket != null) this._socket.end();
		this._socket = null;

		// also reject all commands currently in the queue
		for(let c of this._commandQueue) {
			let reject = c.reject;
			if(reject != undefined) {
				reject(err);
			}
		}

		this._commandQueue = []; // reset commandqueue so commands dont get stuck if the controller becomes unavailable
	}

	_sendColorChangeCommand(red, green, blue, ww, cw, mask, callback) {
		red = clamp(red, 0, 255);
		green = clamp(green, 0, 255);
		blue = clamp(blue, 0, 255);
		ww = clamp(ww, 0, 255);

		let cmd_buf;
		if (this._options.cold_white_support) {
			cmd_buf = Buffer.from([ 0x31, red, green, blue, ww, cw, mask, 0x0f ]);
		} else {
			cmd_buf = Buffer.from([ 0x31, red, green, blue, ww, mask, 0x0f ]);
		}

		let promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, this._options.ack.color, resolve, reject);
		}).then(data => {
			return (data.length > 0 || !this._options.ack.color); 
		}).then(result => {
			if (result) {
				this._lastColor = { red, green, blue };
				this._lastWW = ww;
				this._lastCW = cw;
			}
			return result;
		});

		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}

		return promise;
	}

	/**
	 * Sets the power state either to on or off
	 * @param {Boolean} on 
	 * @param {function} callback called with (err, success)
	 * @returns {Promise<boolean>}
	 */
	setPower(on, callback) {
		let cmd_buf = Buffer.from([0x71, (on) ? 0x23 : 0x24, 0x0f]);

		let promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, this._options.ack.power, resolve, reject);
		}).then(data => {
			return (data.length > 0 || !this._options.ack.power); // the responses vary from controller to controller and I don't know what they mean
		});

		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}

		return promise;
	}

	/**
	 * Convenience method to call setPower(true)
	 * @param {function} callback
	 * @returns {Promise<boolean>}
	 */
	turnOn(callback) {
		return this.setPower(true, callback);
	}

	/**
	 * Convenience method to call setPower(false)
	 * @param {function} callback
	 * @returns {Promise<boolean>}
	 */
	turnOff(callback) {
		return this.setPower(false, callback);
	}

	/**
	 * Sets the color and warm white values of the controller.
	 * Also saves the values for further calls to setColor, setWarmWhite, etc
	 * @param {Number} red 
	 * @param {Number} green 
	 * @param {Number} blue 
	 * @param {Number} ww 
	 * @param {function} callback called with (err, success)
	 * @returns {Promise<boolean>}
	 */
  	setColorAndWarmWhite(red, green, blue, ww, callback) {
		return this._sendColorChangeCommand(red, green, blue, ww, this._lastCW, 0, callback);
	}

	/**
	 * Sets the color and white values of the controller.
	 * Also saves the values for further calls to setColor, setWarmWhite, etc
	 * @param {Number} red 
	 * @param {Number} green 
	 * @param {Number} blue 
	 * @param {Number} ww warm white
	 * @param {Number} cw cold white
	 * @param {function} callback called with (err, success)
	 * @returns {Promise<boolean>}
	 */
	setColorAndWhites(red, green, blue, ww, cw, callback) {
		return this._sendColorChangeCommand(red, green, blue, ww, cw, 0, callback);
	}

	/**
	 * Sets the color values of the controller.
	 * Depending on apply_masks, only the color values, or color values as well as previous warm white values will be sent
	 * @param {Number} red 
	 * @param {Number} green 
	 * @param {Number} blue 
	 * @param {function} callback called with (err, success)
	 * @returns {Promise<boolean>}
	 */
	setColor(red, green, blue, callback) {
		if (this._options.apply_masks) {
			return this._sendColorChangeCommand(red, green, blue, 0, 0, 0xF0, callback);
		} else {
			return this.setColorAndWhites(red, green, blue, this._lastWW, this._lastCW, callback);
		}
	}

	/**
	 * Sets the warm white values of the controller.
	 * Depending on apply_masks, only the warm white values, or warm white values as well as previous color values will be sent
	 * @param {Number} ww 
	 * @param {function} callback called with (err, success)
	 * @returns {Promise<boolean>}
	 */
  	setWarmWhite(ww, callback) {
		if (this._options.apply_masks) {
			return this._sendColorChangeCommand(0, 0, 0, ww, this._lastCW, 0x0F, callback);
		} else {
			return this.setColorAndWarmWhite(this._lastColor.red, this._lastColor.green, this._lastColor.blue, ww, callback);
		}
	}

	/**
	 * Sets the white values of the controller.
	 * Depending on apply_masks, only the cold white values, or cold white values as well as previous color values will be sent
	 * @param {Number} ww warm white
	 * @param {Number} cw cold white
	 * @param {function} callback called with (err, success)
	 * @returns {Promise<boolean>}
	 */
	setWhites(ww, cw, callback) {
		if (cw != 0 && !this._options.cold_white_support) {
			console.warn("WARNING: Cold white support is not enabled, but the cold white values was set to a non-zero value.");
		}

		if (this._options.apply_masks) {
			return this._sendColorChangeCommand(0, 0, 0, ww, cw, 0x0F, callback);
		} else {
			return this.setColorAndWhites(this._lastColor.red, this._lastColor.green, this._lastColor.blue, ww, cw, callback);
		}
	}

	/**
	 * Convenience method to scale down the colors with a brightness value between 0 and 100
	 * If you send red, green and blue to 0, this sets the color to white with the specified brightness (but not warm white!)
	 * @param {Number} red 
	 * @param {Number} green 
	 * @param {Number} blue 
	 * @param {Number} brightness 
	 * @param {function} callback 
	 * @returns {Promise<boolean>}
	 */
	setColorWithBrightness(red, green, blue, brightness, callback) {
		brightness = clamp(brightness, 0, 100);

		let r = (255/100) * brightness;
		let g = (255/100) * brightness;
		let b = (255/100) * brightness;

		if(red > 0 || green > 0 || blue > 0) {
			r = Math.round(clamp(red, 0, 255) / 100 * brightness);
			g = Math.round(clamp(green, 0, 255) / 100 * brightness);
			b = Math.round(clamp(blue, 0, 255) / 100 * brightness);
		}

		return this.setColor(r, g, b, callback);
	}

	/**
	 * Sets the controller to display one of the predefined patterns
	 * @param {String} pattern Name of the pattern
	 * @param {Number} speed between 0 and 100
	 * @param {function} callback 
	 * @returns {Promise<boolean>}
	 */
	setPattern(pattern, speed, callback) {
		let pattern_code = patterns[pattern];
		if(pattern_code == undefined) {
			let promise = Promise.reject(new Error("Invalid pattern"));
			
			if (callback && typeof callback == 'function') {
				promise.then(callback.bind(null, null), callback);
			}

			return promise;
		}

		let delay = speedToDelay(speed);

		let cmd_buf = Buffer.from([0x61, pattern_code, delay, 0x0f]);

		let promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, this._options.ack.pattern, resolve, reject);
		}).then(data => {
			return (data.length > 0 || !this._options.ack.pattern); 
		});

		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}

		return promise;
	}

	/**
	 * Sets the controller to display a custom pattern
	 * @param {CustomMode} pattern 
	 * @param {Number} speed 
	 * @param {function} callback
	 * @returns {Promise<boolean>}
	 */
	setCustomPattern(pattern, speed, callback) {
		if (!(pattern instanceof CustomMode)) {
			let promise = Promise.reject(new Error("Invalid pattern"));
			
			if (callback && typeof callback == 'function') {
				promise.then(callback.bind(null, null), callback);
			}

			return promise;
		}

		let delay = speedToDelay(speed);

		// construct command buffer
		let cmd_buf_values = [ 0x51 ];
		
		for(let i = 0; i < 16; i++) {
			if (pattern.colors[i]) {
				cmd_buf_values.push(pattern.colors[i].red, pattern.colors[i].green, pattern.colors[i].blue, 0);
			} else {
				cmd_buf_values.push(1, 2, 3, 0);
			}
		}

		cmd_buf_values.push(delay);

		switch (pattern.transitionType) {
			case "fade":
				cmd_buf_values.push(0x3a);
				break;
			case "jump":
				cmd_buf_values.push(0x3b);
				break;
			case "strobe":
				cmd_buf_values.push(0x3c);
				break;
		}

		cmd_buf_values.push(0xff, 0x0f);

		let cmd_buf = Buffer.from(cmd_buf_values);

		let promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, this._options.ack.custom_pattern, resolve, reject);
		}).then(data => {
			return (data.length > 0 || !this._options.ack.custom_pattern); 
		});

		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}

		return promise;
	}

	/**
	 * Creates a new EffectInterface, which establishes a persistent connection to the controller
	 * @param {function} callback
	 * @returns {Promise<EffectInterface>}
	 */
	startEffectMode(callback) {
		let promise = new Promise((resolve, reject) => {
			new EffectInterface(this._address, PORT, this._options, (err, effect_interface) => {
				if (err) return reject(err);

				resolve(effect_interface);
			});
		});
	
		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}

		return promise;
	}

	/**
	 * Queries the controller for it's current state
	 * This method stores the color and ww values for future calls to setColor, setWarmWhite, etc.
	 * It will also set apply_masks to true for controllers which require it.
	 * @param {function} callback
	 * @returns {Promise<QueryResponse>}
	 */
	queryState(callback) {
		let cmd_buf = Buffer.from([0x81, 0x8a, 0x8b]);

		let promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, true, resolve, reject);
		}).then(data => {
			if(data.length < 14) throw new Error("Only got short reply");

			let state = {
				type: data.readUInt8(1),
				on: (data.readUInt8(2) == 0x23),
				mode: determineMode(data),
				speed: delayToSpeed(data.readUInt8(5)),
				color: {
					red: data.readUInt8(6),
					green: data.readUInt8(7),
					blue: data.readUInt8(8)
				},
				warm_white: data.readUInt8(9),
				cold_white: data.readUInt8(11)
			};

			this._lastColor = { red: state.color.red, green: state.color.green, blue: state.color.blue };
			this._lastWW = state.warm_white;
			this._lastCW = state.cold_white;

			switch (state.type) {
				case 0x25:
					this._options.apply_masks = true;
					break;
				case 0x35:
					this._options.apply_masks = true;
					this._options.cold_white_support = true;
					break;
				case 0x44:
					this._options.apply_masks = true;
					break;
				// otherwise do not change any options
			}

			return state;
		});

		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}

		return promise;
	}
}

module.exports = Control;
