const dgram = require("dgram");
const os = require("os");

const { NODE_VERSION } = require("./constants");

const DISCOVERY_PORT = 48899;
const BROADCAST_ADDR = "255.255.255.255";
const IPV4_FAMILY = (NODE_VERSION.major >= 18) ? 4 : "IPv4";

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
		const promise = new Promise((resolve, reject) => {
			const socket = dgram.createSocket("udp4");

			let addresses = [];

			if (os.platform() == "win32") {
				let ifaces = os.networkInterfaces();
			
				for(let i in ifaces) {
					let iface_addresses = ifaces[i].filter(iface => iface.family == IPV4_FAMILY && !iface.internal).map(iface => iface.address);
					
					// create broadcast address from interface adress
					iface_addresses = iface_addresses.map(addr => {
						let blocks = addr.split(".");
						blocks[3] = "255";
						return blocks.join(".");
					});

					addresses.push(...iface_addresses);
				}
			} else {
				addresses = [ BROADCAST_ADDR ];
			}

			socket.on("error", err => {
				socket.close();
				reject(err);
			});

			socket.on("message", (msg, rinfo) => {
				const tmpInfos = msg.toString().split(',');

				if (tmpInfos.length == 3){
					this._clients.push({
						address: tmpInfos[0],
						id: 	tmpInfos[1],
						model: 	tmpInfos[2]
					});
				}
			});

			socket.on("listening", () => {
				socket.setBroadcast(true);

				addresses.forEach(addr => socket.send("HF-A11ASSISTHREAD", DISCOVERY_PORT, addr));
			});

			socket.bind(DISCOVERY_PORT);

			setTimeout(() => {
				socket.close();

				this._scanned = true;
				resolve(this._clients);
			}, timeout);
		});

		if (callback && typeof callback == "function") {
			promise.then(callback.bind(null, null), callback);
		}
		
		return promise;
	}
}

module.exports = Discovery;