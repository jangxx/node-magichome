const mergeOptions = require('merge-options');

const ControlBase = require("./ControlBase");

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, Math.round(value)));
}

class ControlAddressable extends ControlBase {
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
			this._sendCommand(cmd_buf, true, resolve, reject);
		}).then(data => {
			return (data.length > 0 || !this._options.ack.power); // the responses vary from controller to controller and I don't know what they mean
		});

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
	 * @returns {Promise<QueryResponse>}
	 */
	queryState() {
		let cmd_buf = Buffer.from([0x81, 0x8a, 0x8b]);

		const promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, true, resolve, reject);
		}).then(data => {
			if(data.length < 14) throw new Error("Only got short reply");

            console.log(data);

            console.log(data.readUInt8(3), data.readUInt8(4), data.readUInt16BE(3));

			// const mode = determineMode(data);
            const mode = null;

			let state = {
				type: data.readUInt8(1),
				on: (data.readUInt8(2) == 0x23),
				mode: mode,
				pattern: determinePattern(data),
				speed: (mode !== "ia_pattern") ? delayToSpeed(data.readUInt8(5)) : data.readUInt8(5),
				color: {
					red: data.readUInt8(6),
					green: data.readUInt8(7),
					blue: data.readUInt8(8)
				},
				warm_white: data.readUInt8(9),
				cold_white: data.readUInt8(11)
			};

			return state;
		});

		return promise;
	}

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

		console.log(o);

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

		console.log(cmd_buf);

		const promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, false, resolve, reject);
		});

		return promise;
	}

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

        console.log(cmd_buf);

		const promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, false, resolve, reject);
		});

		return promise;
    }

    setMultiColorMode(modeDefiniton) {
        let colorArray = [];

        if (modeDefiniton._colorStops[0] === undefined) {
            return Promise.reject("No start color defined");
        }

        let currentColor;

        for (let i = 0; i < modeDefiniton._length; i++) {
            if (modeDefiniton._colorStops[i] !== undefined) {
                currentColor = modeDefiniton._colorStops[i];
            }

            colorArray.push(
                clamp(currentColor.red, 0, 255),
                clamp(currentColor.green, 0, 255),
                clamp(currentColor.blue, 0, 255),
            );
        }

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

        console.log(cmd_buf);

        const promise = new Promise((resolve, reject) => {
			this._sendCommand(cmd_buf, false, resolve, reject);
		});

		return promise;
    }
}

module.exports = ControlAddressable;