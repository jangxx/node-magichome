var Discovery = require('../index.js').Discovery;

var discover = new Discovery();

/* Promise example
discover.scan().then((data) => {
	console.log(data);
});
*/

discover.scan((err, data) => {
	console.log(err);
	console.log(data);
});