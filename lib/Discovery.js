const dgram = require('dgram');
const DISCOVERY_PORT = 48899;
const BROADCAST_ADDR = '255.255.255.255';

class Discovery {
	constructor() {
		this._clients = [];
	}

	scan() {
		const callback = arguments[arguments.length - 1];
		const timeout = arguments.length > 1 ? arguments[0] : 500;

		const promise = new Promise((resolve, reject) => {
			const socket = dgram.createSocket('udp4');

			socket.on('error', (err) => {
				console.log(`udp dgram error:\n${err.stack}`);
				socket.close();
				reject(err.stack);
			});

			socket.on('message', (msg, rinfo) => {
				let tmpInfos = msg.toString().split(',');

				if (tmpInfos.length == 3){
					this._clients.push({
						address: tmpInfos[0],
						id: 	tmpInfos[1],
						model: 	tmpInfos[2]
					})
				}
			});

			socket.on('listening', () => {
				socket.setBroadcast(true);
				socket.send('HF-A11ASSISTHREAD', DISCOVERY_PORT, BROADCAST_ADDR);
			});

			socket.bind(DISCOVERY_PORT);

			setTimeout(() => {
				socket.close();
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