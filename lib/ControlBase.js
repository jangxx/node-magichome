const net = require('net');

const { PORT } = require("./constants");

// some controllers send their responses in multiple chunks, and we only know that we got the full message, if the controller doesn't send something for a while
const RESPONSE_TIMEOUT = 500; // 0.5 sec

/**
 * Internal class so no further documentation provided
 */
class ControlBase {
	constructor(address, command_timeout, connect_timeout, log_all_received) {
		this._address = address;
        this._command_timeout = command_timeout;
        this._connect_timeout = connect_timeout;
        this._log_all_recevied = log_all_received;

		this._commandQueue = [];

		this._socket = null;

		this._receivedData = Buffer.alloc(0);
		this._receiveTimeout = null;
		this._connectTimeout = null;
		this._commandTimeout = null;
		this._preventDataSending = false;
	}

	_receiveData(empty, data) {
		if (this._commandTimeout !== null) { // we have received _something_ so the command cannot timeout anymore
			clearTimeout(this._commandTimeout);
			this._commandTimeout = null;
		}

		if (empty) {
			// no data, so request is instantly finished
			// this can happend when a command is sent without waiting for a reply or when a timeout is reached
			let finished_command = this._commandQueue[0];

			if (finished_command != undefined) {
				const resolve = finished_command.resolve;
				if (resolve != undefined) {
					resolve(this._receivedData);
				}
			}

			// clear received data
			this._receivedData = Buffer.alloc(0);

			this._commandQueue.shift();

			this._handleNextCommand();
		} else {
			this._receivedData = Buffer.concat([ this._receivedData, data ]);

			if (this._receiveTimeout != null) clearTimeout(this._receiveTimeout);

			// since we don't know how long the response is going to be, set a timeout after which we consider the
			// whole message to be received
			this._receiveTimeout = setTimeout(() => {
				this._receiveData(true);
			}, RESPONSE_TIMEOUT);
		}
	}

	_handleCommandTimeout() {
		this._commandTimeout = null;

		let timedout_command = this._commandQueue[0];

		if (timedout_command !== undefined) {
			const reject = timedout_command.reject;
			if (reject != undefined) {
				reject(new Error("Command timed out"));
			}
		}

		this._receivedData = Buffer.alloc(0); // just for good measure

		this._commandQueue.shift();

		this._handleNextCommand();
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
				this._socket.write(cmd.command, "binary", () => {
					if (this._command_timeout === null) return;

					this._commandTimeout = setTimeout(() => {
						this._handleCommandTimeout();
					}, this._command_timeout);
				});
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
				if (this._log_all_received) {
					console.log("Received:", data.toString("hex").replace(/(\w{2})/g, "$1 "));
				}
				
				this._receiveData(false, data);
			});

			if (this._connect_timeout != null) {
				this._connectTimeout = setTimeout(() => {
					this._socketErrorHandler(new Error("Connection timeout reached"), reject);
				}, this._connect_timeout);
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
}

module.exports = ControlBase;
