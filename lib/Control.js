const net = require('net');
const EffectInterface = require('./EffectInterface');
const CustomMode = require('./CustomMode');

const PORT = 5577;
const TCP_TIMEOUT = 500; // 0.5 sec

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
	/*
	 * address: ip or hostname of the controller in question
	 * characteristics: object which describes the behavior and the quirks of the controller (like if they acknowledge commands of if the colors work from 0 or 1 to 255)
	 */
	constructor(address, options = {}) {
		this._address = address;

		this._options = Object.assign({
			wait_for_reply: true,
			log_all_received: false
		}, options);

		this._commandQueue = [];

		this._socket = null;

		this._receivedData = Buffer.alloc(0);
		this._receiveTimeout = null;

		// store the values of the last sent/received values to enable the convenience methods
		this._lastColor = { red: 0, green: 0, blue: 0 };
		this._lastWW = 0;
	}

	static get patternNames() {
		return Object.keys(patterns);
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
			}, TCP_TIMEOUT);
		}
	}

	_handleNextCommand() {
		if(this._commandQueue.length == 0) {
			if(this._socket != null) this._socket.end();
			this._socket = null;
		} else {
			let cmd = this._commandQueue[0];

			if(!cmd.expect_reply) {
				this._socket.write(cmd.command, "utf8", () => {
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

			this._socket = net.connect(PORT, this._address, () => {
				this._handleNextCommand(); // which is the "first" command in this case
			});

			this._socket.on('error', (err) => {
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
			});

			this._socket.on('data', (data) => {
				if (this._options.log_all_received) {
					console.log("Received:", data.toString("hex").replace(/(\w{2})/g, "$1 "));
				}
				
				this._receiveData(false, data);
			});
		} else {
			this._commandQueue.push({ expect_reply, resolve, reject, command });
		}
	}

	/**
	 * Sets the power state either to on or off
	 * @param {Boolean} on 
	 * @param {function} callback called with (err, success)
	 * @returns A Promise
	 */
	setPower(on, callback) {
		let cmd_buf = Buffer.from([0x71, (on) ? 0x23 : 0x24, 0x0f]);

		let promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, this._options.wait_for_reply, resolve, reject);
		}).then(data => {
			return (data.length > 0 || !this._options.wait_for_reply); // the responses vary from controller to controller and I don't know what they mean
		});

		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}

		return promise;
	}

	turnOn(callback) {
		return this.setPower(true, callback);
	}

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
	 * @returns A Promise
	 */
  	setColorAndWarmWhite(red, green, blue, ww, callback) {
		red = clamp(red, 0, 255);
		green = clamp(green, 0, 255);
		blue = clamp(blue, 0, 255);
		ww = clamp(ww, 0, 255);

		let cmd_buf = Buffer.from([ 0x31, red, green, blue, ww, 0, 0x0f ]);

		let promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, this._options.wait_for_reply, resolve, reject);
		}).then(data => {
			return (data.length > 0 || !this._options.wait_for_reply); 
		}).then(result => {
			if (result) {
				this._lastColor = { red, green, blue };
				this._lastWW = ww;
			}
			return result;
		});

		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}

		return promise;
	}

	setColor(red, green, blue, callback) {
		return this.setColorAndWarmWhite(red, green, blue, this._lastWW, callback);
	}

  	setWarmWhite(ww, callback) {
		return this.setColorAndWarmWhite(this._lastColor.red, this._lastColor.green, this._lastColor.blue, ww, callback);
	}

	/**
	 * Convenience method to scale down the colors with a brightness value between 0 and 100
	 * If you send red, green and blue to 0, this sets the color to white with the specified brightness (but not warm white!)
	 * @param {Number} red 
	 * @param {Number} green 
	 * @param {Number} blue 
	 * @param {Number} brightness 
	 * @param {function} callback 
	 * @returns A Promise
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
	 * @returns A Promise
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
			this._sendCommand(cmd_buf, this._options.wait_for_reply, resolve, reject);
		}).then(data => {
			return (data.length > 0 || !this._options.wait_for_reply); 
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
	 * @returns A Promise
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
			this._sendCommand(cmd_buf, this._options.wait_for_reply, resolve, reject);
		}).then(data => {
			return (data.length > 0 || !this._options.wait_for_reply); 
		});

		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}

		return promise;
	}

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
	 * Also stores the color and ww values for future calls to setColor, setWarmWhite, etc.
	 * @param {function} callback
	 * @returns A promise resolving to the state
	 */
	queryState(callback) {
		let cmd_buf = Buffer.from([0x81, 0x8a, 0x8b]);

		let promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, true, resolve, reject);
		}).then(data => {
			if(data.length < 14) throw new Error("Only got short reply");

			let state = {
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

			return state;
		});

		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}

		return promise;
	}
}

module.exports = Control;
