const net = require('net');

class EffectInterface {
	constructor(address, port, callback) {
		var self = this;

		this._address = address;
		this._port = port;
		this._socket = net.connect(this._port, this._address);

		this._socket.on('data', function(data) {
			self._processResponse.call(self, data);
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
		var checksum = 0;
		for(let byte of buf.values()) {
			checksum += byte;
		}
		checksum &= 0xFF;

		var command = Buffer.concat([ buf, Buffer.from( [checksum] ) ]);

		this._socket.write(command);
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
		var cmd_buf = Buffer.from([0x41, red, green, blue, 0x00, 0xf0, 0x0f]);
		this._sendCommand(cmd_buf);
	}
}

module.exports = EffectInterface;
