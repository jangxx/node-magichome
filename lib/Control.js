const net = require('net');
const EffectInterface = require('./EffectInterface.js');

const PORT = 5577;
const TCP_TIMEOUT = 500; //0.5 sec

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
	var bit10 = resp.readUInt8(9);

	if(pattern == 0x61) {
		if(bit10 != 0) {
			return "warm_white";
		} else {
			return "color";
		}
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
	constructor(address, characteristics) {
		if(characteristics == undefined) characteristics = {};

		this._address = address;
		this._characteristics = Object.assign({
			rgb_min_0: true, //is 0 the lowest value for r/g/b? (otherwise it's 1)
			ww_min_0: true,
			wait_for_reply: true,
			set_color_magic_bytes: [0xf0, 0x0f] //could also be 0x00,0x0f or something else
		}, characteristics);
		this._commandQueue = [];
		this._socket = null;
		this._aggregatedData = Buffer.alloc(0);
		this._aggregateTimeout = null;
	}

	_sendCommand(buf, expect_reply, callback) {
		var self = this;
		var checksum = 0;
		for(let byte of buf.values()) {
			checksum += byte;
		}
		checksum &= 0xFF;

		var command = Buffer.concat([ buf, Buffer.from( [checksum] ) ]);

		if(this._commandQueue.length == 0 && this._socket == null) {
			this._commandQueue.push({callback: callback, expect_reply: expect_reply});

			this._socket = net.connect(PORT, this._address, function() {
				if(!expect_reply) {
					self._socket.write(command, "utf8", function() {
						return receiveCallback(true);
					});
				} else {
					self._socket.write(command);
				}
			});

			this._socket.on('error', function(err) {
				callback(err);
				if(self._socket != null) self._socket.end();
				self._socket = null;
                for(let cq of self._commandQueue) {
                    let cb = cq.callback;
                    if(cb != undefined) {
                        cb(err, null);
                    }
                }

                self._commandQueue = []; //reset commandqueue so commands dont get stuck if the controller becomes unavailable
			});

			this._socket.on('data', function(data) {
				receiveCallback(false, data);
			});

			function receiveCallback(empty, data) {
				if(empty) {
					//no data, so request is instantly finished
					var finished_command = self._commandQueue.shift();
					if(finished_command != undefined) {
						var cb = finished_command.callback;
						if(cb != undefined) {
							cb(null, self._aggregatedData);
						}
					}

					self._aggregatedData = Buffer.alloc(0);

					handleNextCommand();
				} else {
					self._aggregatedData = Buffer.concat([self._aggregatedData, data]);

					if(self._aggregateTimeout != null) clearTimeout(self._aggregateTimeout);

					self._aggregateTimeout = setTimeout(function() {
						var finished_command = self._commandQueue.shift();
						if(finished_command != undefined) {
							var cb = finished_command.callback;
							if(cb != undefined) {
								cb(null, self._aggregatedData);
							}
						}


						self._aggregatedData = Buffer.alloc(0);

						handleNextCommand();
					}, TCP_TIMEOUT);
				}
			}

			function handleNextCommand() {
				if(self._commandQueue.length == 0) {
					if(self._socket != null) self._socket.end();
					self._socket = null;
				} else {
					var cmd = self._commandQueue[0];

					if(!cmd.expect_reply) {
						self._socket.write(cmd.command, "utf8", function() {
							return receiveCallback(true);
						});
					} else {
						self._socket.write(cmd.command);
					}
				}
			}
		} else {
			this._commandQueue.push({
				command: command,
				callback: callback,
				expect_reply: expect_reply
			});
		}
	}

	/*
	 * callback(err, success)
	 */
	turnOn(callback) {
		var cmd_buf = Buffer.from([0x71, 0x23, 0x0f]);

		if(this._characteristics.wait_for_reply) {
			this._sendCommand(cmd_buf, true, function(err, data) {
				if(err) return callback(err);

				var code = data.readUInt8(0);
				return callback(null, code == 0x30);
			});
		} else {
			this._sendCommand(cmd_buf, false, function(err) {
				return callback(null, true);
			});
		}
	}

	/*
	 * callback(err, success)
	 */
	turnOff(callback) {
		var cmd_buf = Buffer.from([0x71, 0x24, 0x0f]);

		if(this._characteristics.wait_for_reply) {
			this._sendCommand(cmd_buf, true, function(err, data) {
				if(err) return callback(err);

				var code = data.readUInt8(0);
				return callback(null, code == 0x30);
			});
		} else {
			this._sendCommand(cmd_buf, false, function(err) {
				return callback(null, true);
			});
		}
	}

	setColor(red, green, blue, callback) {
		var lower_bound = (this._characteristics.rgb_min_0) ? 0 : 1;
		var ww_value = (this._characteristics.ww_min_0) ? 0 : 0xFF;

		red = clamp(red, lower_bound, 255);
		green = clamp(green, lower_bound, 255);
		blue = clamp(blue, lower_bound, 255);

		var cmd_buf = Buffer.from([0x31, red, green, blue, ww_value, this._characteristics.set_color_magic_bytes[0], this._characteristics.set_color_magic_bytes[1]]);

		if(this._characteristics.wait_for_reply) {
			this._sendCommand(cmd_buf, true, function(err, data) {
				if(err) return callback(err);

				var code = data.readUInt8(0);
				return callback(null, code == 0x30);
			});
		} else {
			this._sendCommand(cmd_buf, false, function(err) {
				return callback(null, true);
			});
		}
	}

	/*
	 * Convenience method to scale down the colors with a brightness value between 0 and 100
	 */
	setColorWithBrightness(red, green, blue, brightness, callback) {
		brightness = clamp(brightness, 0, 100);

		if(red > 0 || green > 0 || blue > 0) {
			var r = Math.round(clamp(red, 0, 255) / 100 * brightness);
			var g = Math.round(clamp(green, 0, 255) / 100 * brightness);
			var b = Math.round(clamp(blue, 0, 255) / 100 * brightness);
		} else {
			var r = g = b = (255/100) * brightness;
		}

		this.setColor(r,g,b, callback);
	}

	setPattern(pattern, speed, callback) {
		var pattern_code = patterns[pattern];
		if(pattern_code == undefined) return callback(new Error("Invalid pattern"));

		var delay = speedToDelay(speed);

		var cmd_buf = Buffer.from([0x61, pattern_code, delay, 0x0f]);

		if(this._characteristics.wait_for_reply) {
			this._sendCommand(cmd_buf, true, function(err, data) {
				if(err) return callback(err);

				var code = data.readUInt8(0);
				return callback(null, code == 0x30);
			});
		} else {
			this._sendCommand(cmd_buf, false, function(err) {
				return callback(null, true);
			});
		}
	}

	startEffectMode(callback) {
		return new EffectInterface(this._address, PORT, this._characteristics, callback);
	}

	queryState(callback) {
		var cmd_buf = Buffer.from([0x81, 0x8a, 0x8b]);

		this._sendCommand(cmd_buf, true, function(err, data) {
			if(err) return callback(err);
			if(data.length < 14) return callback(new Error("Only got short reply"));

			//console.log(data, determineMode(data));

			var state = {
				on: (data.readUInt8(2) == 0x23),
				mode: determineMode(data),
				speed: delayToSpeed(data.readUInt8(5)),
				color: {
					red: data.readUInt8(6),
					green: data.readUInt8(7),
					blue: data.readUInt8(8)
				},
				warm_white_percent: (data.readUInt8(9) / 255) * 100,
			};

			return callback(null, state);
		});
	}
}

module.exports = Control;
