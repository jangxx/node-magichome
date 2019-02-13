const dgram = require('dgram');
const DISCOVERY_PORT = 48899;
const BROADCAST_ADDR = '255.255.255.255';

class Discovery {
	constructor() {
		this._scanned = false;
		this._clients = [];
	}

	get clients() {
		return this._clients;
	}

	get scanned() {
		return this._scanned;
	}

	/**
	 * Convenience method which shortens the discovery operation to a single line
	 */
	static scan(timeout) {
		return new Discovery().scan(timeout);
	}

	/**
	 * Send a scan packet into the network
	 * @param {Number} timeout number of milliseconds to wait before the clients are returned
	 * @param {function} callback Called with (err, clients)
	 * @returns A Promise resolving to the found clients
	 */
	scan(timeout = 500, callback = undefined) {
		let promise = new Promise((resolve, reject) => {
			let socket = dgram.createSocket('udp4');

			socket.on('error', (err) => {
				socket.close();
				reject(err);
			});

			socket.on('message', (msg, rinfo) => {
				let tmpInfos = msg.toString().split(',');

				if (tmpInfos.length == 3){
					this._clients.push({
						address: tmpInfos[0],
						id: 	tmpInfos[1],
						model: 	tmpInfos[2]
					});
				}
			});

			socket.on('listening', () => {
				socket.setBroadcast(true);
				socket.send('HF-A11ASSISTHREAD', DISCOVERY_PORT, BROADCAST_ADDR);
			});

			socket.bind(DISCOVERY_PORT);

			setTimeout(() => {
				socket.close();

				this._scanned = true;
				resolve(this._clients);
			}, timeout);
		});

		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}
		
		return promise;
	}
}

module.exports = Discovery;