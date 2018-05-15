var Discovery = require('../index.js').Discovery;

var discover = new Discovery();

discover.scan().then((data) => {
	console.log(data);
});
