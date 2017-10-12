var MHControl = require('../').Control;

var ip = process.argv[2];

if(ip == undefined) {
	console.log("Usage: node effect_test.js <ip>");
	process.exit();
}

var c = new MHControl(ip);

var on = false;
var need_delay = false;

c.startEffectMode(function(effects) {
	effects.start(function() {
		var seconds = (new Date()).getSeconds();

		if(need_delay) {
			effects.delay(1000);
			need_delay = false;
			return;
		}

		if(!on) {
			if(is_between(seconds, 0, 19)) {
				effects.setColor(255, 0, 0);
			} else if(is_between(seconds, 20, 39)) {
				effects.setColor(0, 255, 0);
			} else if(is_between(seconds, 40, 59)) {
				effects.setColor(0, 0, 255);
			}

			on = true;
			need_delay = true;
		} else {
			effects.setColor(0,0,0);
			on = false;
			need_delay = true;
		}
	});
});

function is_between(value, min, max) {
	return (value >= min) && (value <= max);
}
