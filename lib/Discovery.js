const dgram = require('dgram');
const DISCOVERY_PORT = 48899;
const BROADCAST_ADDR = '255.255.255.255';

class Discovery {
	constructor() {
		this._clients = [];
	}

	scan(callback) {
		const promise = new Promise((resolve, reject) => {
			const server = dgram.createSocket('udp4');

			server.on('error', (err) => {
				console.log(`udp dgram error:\n${err.stack}`);
				server.close();
				reject(err.stack);
			});

			server.on('message', (msg, rinfo) => {
				let tmpInfos = msg.toString().split(',');

				if (tmpInfos.length == 3){
					this._clients.push({
						ipaddr: tmpInfos[0],
						id: 	tmpInfos[1],
						model: 	tmpInfos[2]
					})
				}
			});

			server.on('listening', () => {
				server.setBroadcast(true);
				server.send('HF-A11ASSISTHREAD', DISCOVERY_PORT, BROADCAST_ADDR);
			});

			server.bind(DISCOVERY_PORT);

			setTimeout(() => {
				server.close();
				resolve(this._clients);
			}, 500);
		});

		if (callback && typeof callback == 'function') {
			promise.then(callback.bind(null, null), callback);
		}
		
		return promise;
	}
}

module.exports = Discovery;