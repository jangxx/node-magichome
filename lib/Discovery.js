const { spawn } = require('child_process');

class Discovery {
	constructor() {
		this._clients = [];
	}

	scan() {
		return new Promise((resolve, reject) => {
			try {
				const scanner = spawn('python', [__dirname + '/../python/scan.py']);

				scanner.stdout.on('data', (data) => {
					this._clients.push(data.toString().replace('\n', ''));
				});

				scanner.stderr.on('data', (data) => {
					console.log(`stderr: ${data}`);
				});

				scanner.on('close', (code) => {
					resolve(JSON.parse("[" + this._clients + "]"));
				});				
			} catch (err){
				console.log("error : " + err);
				reject(err);
			}
		})
	}
}

module.exports = Discovery;