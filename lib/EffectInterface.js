const net = require('net');

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

class EffectInterface {
	constructor(address, port, characteristics, callback) {
		var self = this;

		this._address = address;
		this._port = port;
		this._socket = net.connect(this._port, this._address);
		this._characteristics = characteristics;

		this._socket.on('data', function(data) {
			if(self._characteristics.wait_for_reply) {
				self._processResponse.call(self, data);
			}
		});
		this._socket.on('error', function(err) {
			//console.log(err);
			this._socket.end();
		});
		this._socket.on('connect', function() {
			callback.call(self, self);
		});

		this._interval_function = null;
	}

	_processResponse(resp) {
		if(this._interval_function != null) {
			this._interval_function.call(this);
		}
	}

	_sendCommand(buf) {
		var self = this;
		var checksum = 0;
		for(let byte of buf.values()) {
			checksum += byte;
		}
		checksum &= 0xFF;

		var command = Buffer.concat([ buf, Buffer.from( [checksum] ) ]);

		if(this._characteristics.wait_for_reply) {
			this._socket.write(command); //just write the data and let the data handler handle the rest
		} else {
			this._socket.write(command, "utf8", function() {
				self.delay(200); //don't send out commands too fast
			});
		}
	}

	start(interval_function) {
		this._interval_function = interval_function;
		this._interval_function.call(this);
	}

	stop() {
		this._interval_function = null;
		this._socket.end();
	}

	delay(time) {
		var self = this;
		setTimeout(function() {
			if(self._interval_function != null) {
				self._interval_function.call(self);
			}
		}, time);
	}

	setColor(red, green, blue) {
		var lower_bound = (this._characteristics.rgb_min_0) ? 0 : 1;
		var ww_value = (this._characteristics.ww_min_0) ? 0 : 0xFF;

		red = clamp(red, lower_bound, 255);
		green = clamp(green, lower_bound, 255);
		blue = clamp(blue, lower_bound, 255);

		var cmd_buf = Buffer.from([0x41, red, green, blue, 0x00, this._characteristics.set_color_magic_bytes[0], this._characteristics.set_color_magic_bytes[1]]);
		this._sendCommand(cmd_buf);
	}
}

module.exports = EffectInterface;
