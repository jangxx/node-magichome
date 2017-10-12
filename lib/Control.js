const net = require('net');
const EffectInterface = require('./EffectInterface.js');

const PORT = 5577;

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
	constructor(address) {
		this._address = address;
	}

	_sendCommand(buf, callback) {
		var checksum = 0;
		for(let byte of buf.values()) {
			checksum += byte;
		}
		checksum &= 0xFF;

		var command = Buffer.concat([ buf, Buffer.from( [checksum] ) ]);

		var socket = net.connect(PORT, this._address, function() {
			socket.write(command);
		});

		socket.on('error', function(err) {
			callback(err);
			socket.end();
		});

		socket.on('data', function(data) {
			callback(null, data);
			socket.end();
		});
	}

	/*
	 * callback(err, success)
	 */
	turnOn(callback) {
		var cmd_buf = Buffer.from([0x71, 0x23, 0x0f]);
		this._sendCommand(cmd_buf, function(err, data) {
			if(err) return callback(err);

			var code = data.readUInt8(0);
			return callback(null, code == 0x30);
		});
	}

	/*
	 * callback(err, success)
	 */
	turnOff(callback) {
		var cmd_buf = Buffer.from([0x71, 0x24, 0x0f]);
		this._sendCommand(cmd_buf, function(err, data) {
			if(err) return callback(err);

			var code = data.readUInt8(0);
			return callback(null, code == 0x30);
		});
	}

	setColor(red, green, blue, callback) {
		red = clamp(red, 0, 255);
		green = clamp(green, 0, 255);
		blue = clamp(blue, 0, 255);

		var cmd_buf = Buffer.from([0x31, red, green, blue, 0x00, 0xf0, 0x0f]);
		this._sendCommand(cmd_buf, function(err, data) {
			if(err) return callback(err);

			var code = data.readUInt8(0);
			return callback(null, code == 0x30);
		});
	}

	/*
	 * Convenience method to scale down the colors with a brightness value between 0 and 100
	 */
	setColorWithBrightness(red, green, blue, brightness, callback) {
		brightness = clamp(brightness, 0, 100);
		var r = Math.round(clamp(red, 0, 255) / 100 * brightness);
		var g = Math.round(clamp(green, 0, 255) / 100 * brightness);
		var b = Math.round(clamp(blue, 0, 255) / 100 * brightness);

		setColor(r,g,b, callback);
	}

	setPattern(pattern, speed, callback) {
		var pattern_code = patterns[pattern];
		if(pattern_code == undefined) return callback(new Error("Invalid pattern"));

		var delay = speedToDelay(speed);

		var cmd_buf = Buffer.from([0x61, pattern_code, delay, 0x0f]);
		this._sendCommand(cmd_buf, function(err, data) {
			if(err) return callback(err);

			var code = data.readUInt8(0);
			return callback(null, code == 0x30);
		});
	}

	startEffectMode(callback) {
		return new EffectInterface(this._address, PORT, callback);
	}

	queryState(callback) {
		var cmd_buf = Buffer.from([0x81, 0x8a, 0x8b]);

		this._sendCommand(cmd_buf, function(err, data) {
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
