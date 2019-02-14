const net = require('net');

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

class EffectInterface {
	constructor(address, port, options, connection_callback) {
		this._address = address;
		this._port = port;
		this._socket = net.connect(this._port, this._address);
		this._options = options;

		this._connected = false;
		this._connection_callback_called = false;

		this._socket.on('data', (data) => {
			if (this._options.wait_for_reply) {
				this._processResponse(data);
			} // otherwise the data was noise of some sort
		});

		this._socket.on('error', (err) => {
			//console.log(err);
			this._socket.end();
			this._connected = false;

			if (!this._connection_callback_called) {
				this._connection_callback_called = true;
				connection_callback(err, this);
			}
		});

		this._socket.on('connect', () => {
			this._connected = true;
			if (!this._connection_callback_called) {
				this._connection_callback_called = true;
				connection_callback(null, this);
			}
		});

		this._interval_function = null;
	}

	get connected() {
		return this._connected;
	}

	_processResponse(resp) {
		if(this._interval_function != null) {
			this._interval_function.call(this);
		}
	}

	_sendCommand(buf) {
		let checksum = 0;
		for(let byte of buf.values()) {
			checksum += byte;
		}
		checksum &= 0xFF;

		let command = Buffer.concat([ buf, Buffer.from( [checksum] ) ]);

		if(this._options.wait_for_reply) {
			this._socket.write(command); //just write the data and let the data handler handle the rest
		} else {
			this._socket.write(command, "utf8", () => {
				this.delay(200); //don't send out commands too fast
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
		setTimeout(() => {
			if(this._interval_function != null) {
				this._interval_function.call(this);
			}
		}, time);
	}

	setColor(red, green, blue) {
		red = clamp(red, 0, 255);
		green = clamp(green, 0, 255);
		blue = clamp(blue, 0, 255);

		var cmd_buf = Buffer.from([ 0x41, red, green, blue, 0x00, 0, 0x0f ]);
		this._sendCommand(cmd_buf);
	}
}

module.exports = EffectInterface;
