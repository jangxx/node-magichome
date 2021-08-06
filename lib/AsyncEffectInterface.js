const net = require('net');

class EffectStoppedError extends Error {
    constructor() {
        super("The effect was stopped");
    }
}

class AsyncEffectInterface {
    constructor(address, port, parent, color_ack, apply_masks) {
        this._address = address;
		this._port = port;
        this._color_ack = color_ack;
        this._apply_masks = apply_masks;
        this._parent = parent;

        this._connected = false;

        this._socket = null;
        this._interval_function = null;

        this._globalTimeout = null;
        this._globalResolve = null;
        this._globalReject = null;

        // container for arbitrary userdata to be used in the effect function
        this.userData = {};
    }

    get connected() {
		return this._connected;
	}

    _processResponse(data) {
        if (this._globalResolve !== null) {
            // we need to unset the global promise functions first, since 
            // the resolve will immediately move the control flow back to
            // the interval function
            const resolve = this._globalResolve;
            this._globalResolve = null;
            this._globalReject = null;
            return resolve(true);
        }
    }

    _handleSocketError(err) {
        this._socket.end();
        this._connected = false;

        if (this._globalReject !== null) {
            // see above
            const reject = this._globalReject;
            this._globalResolve = null;
            this._globalReject = null;
            return reject(err); // reject the current color send command
        }
    }

    async _runIntervalFunction() {
        while (this._interval_function !== null) {
            try {
                await this._interval_function(this);
            } catch(err) {
                if (!(err instanceof EffectStoppedError)) {
                    throw err; // rethrow any actual errors
                }
            }
        }
    }

    _sendCommand(buf) {
        // calculate checksum
		let checksum = 0;
		for(let byte of buf.values()) {
			checksum += byte;
		}
		checksum &= 0xFF;

		const command = Buffer.concat([ buf, Buffer.from( [checksum] ) ]);

		if(this._color_ack) {
			this._socket.write(command); // just write the data and let the data handler handle the rest
		} else {
			this._socket.write(command, "utf8", () => {
				setTimeout(() => {
                    if (this._globalResolve !== null) { // it's possible for the error handler to delete the reference in the meantime
                        const resolve = this._globalResolve;
                        this._globalResolve = null;
                        this._globalReject = null;
                        return resolve(true);
                    }
                }, 100); // 100ms minimum delay
			});
		}
	}

    _sendColorChangeCommand(red, green, blue, ww, cw, mask) {
        if (this._interval_function === null) {
            return Promise.reject(new EffectStoppedError());
        }

        // build a non-permanent command
		const cmd_buf = this._parent._buildColorChangeCommand(red, green, blue, ww, cw, mask, false);

        if (this._globalResolve !== null || this._globalReject !== null) {
            return Promise.resolve(false); // don't change the control flow
        }

        return new Promise((resolve, reject) => {
            this._globalResolve = resolve;
            this._globalReject = reject;

            this._sendCommand(cmd_buf);
        });
	}

    connect() {
        if (this._connected || this._socket !== null) {
            return Promise.reject("Already started");
        }

        this._socket = net.connect(this._port, this._address);

        return new Promise((resolve, reject) => {
            const tempErrorHandler = err => {
                this._socket.off("error", tempErrorHandler);
                this._socket.off("connect", tempConnectionHandler);

                this._handleSocketError(err);

                return reject(err);
            };

            const tempConnectionHandler = () => {
                this._socket.off("error", tempErrorHandler);
                this._socket.off("connect", tempConnectionHandler);

                this._socket.on("error", this._handleSocketError); // attach the proper error handler
                this._connected = true;

                return resolve();
            };

            this._socket.on("data", data => {
                if (this._color_ack) {
                    this._processResponse(data);
                } // otherwise ignore
            });

            this._socket.on("error", tempErrorHandler);
            this._socket.on("connect", tempConnectionHandler);
        });
    }

    start(interval_function) {
        if (this._interval_function !== null) {
            return Promise.reject(new Error("An effect is still running"));
        }

        this._interval_function = interval_function;
        return this._runIntervalFunction();
    }

    stop() {
        this._interval_function = null;

        if (this._globalTimeout !== null) {
            clearTimeout(this._globalTimeout);
            this._globalTimeout = null;
        }
    }

    end() {
        this.stop();
        this._socket.end();
        this._connected = false;
        this._socket = null;
    }

    delay(milliseconds) {
        if (this._globalTimeout !== null) return Promise.resolve(); // don't split the control flow

        if (this._interval_function === null) {
            return Promise.reject(new EffectStoppedError());
        }

        return new Promise(resolve => {
            this._globalTimeout = setTimeout(() => {
                this._globalTimeout = null;
                resolve();
            }, milliseconds);
        });
    }

    setColorAndWarmWhite(red, green, blue, warm_white) {
		return this._sendColorChangeCommand(red, green, blue, warm_white, 0, 0);
	}

    setColorAndWhites(red, green, blue, warm_white, cold_white) {
		return this._sendColorChangeCommand(red, green, blue, warm_white, cold_white, 0);
	}

    setColor(red, green, blue) {
		if (this._apply_masks) {
			return this._sendColorChangeCommand(red, green, blue, 0, 0, 0xF0);
		} else {
			return this.setColorAndWhites(red, green, blue, 0, 0);
		}
	}

    setWarmWhite(warm_white) {
		if (this._apply_masks) {
			return this._sendColorChangeCommand(0, 0, 0, warm_white, 0, 0x0F);
		} else {
			return this.setColorAndWarmWhite(0, 0, 0, warm_white);
		}
	}

    setWhites(warm_white, cold_white) {
		if (this._apply_masks) {
			return this._sendColorChangeCommand(0, 0, 0, warm_white, cold_white, 0x0F);
		} else {
			return this.setColorAndWhites(0, 0, 0, warm_white, cold_white);
		}
	}
}

/**
 * A class that helps with timing an effect where each of the commands are asynchronous
 */
class EffectTimingHelper {
    constructor(parent) {
        this._parent = parent;
        this._startTime = null;
    }

    isStarted() {
        return this._startTime !== null;
    }

    start() {
        this._startTime = new Date().getTime();
    }

    async delayRemaining(milliseconds) {
        const now = new Date().getTime();
        const remaining = this._startTime + milliseconds - now;

        if (remaining > 0) {
            await this._parent.delay(remaining);
        }

        this._startTime = this._startTime + milliseconds;
    }
}

module.exports = {
    AsyncEffectInterface,
    EffectTimingHelper,
};