var { Control: MHControl, Discovery: MHDiscovery } = require('../');

const patterns = Object.freeze({
	seven_color_cross_fade: 0x25,
	red_gradual_change: 0x26,
	green_gradual_change: 0x27,
	blue_gradual_change: 0x28,
	yellow_gradual_change: 0x29,
	cyan_gradual_change: 0x2a,
	purple_gradual_change: 0x2b,
	white_gradual_change: 0x2c,
	red_green_cross_fade: 0x2d,
	red_blue_cross_fade: 0x2e,
	green_blue_cross_fade: 0x2f,
	seven_color_strobe_flash: 0x30,
	red_strobe_flash: 0x31,
	green_strobe_flash: 0x32,
	blue_stobe_flash: 0x33,
	yellow_strobe_flash: 0x34,
	cyan_strobe_flash: 0x35,
	purple_strobe_flash: 0x36,
	white_strobe_flash: 0x37,
	seven_color_jumping: 0x38
});

const characteristics = Object.freeze({
	type1: {
		rgb_min_0: true,
		ww_min_0: true,
		set_color_magic_bytes: [0xf0, 0x0f],
		wait_for_reply: true
	},
	type2: {
		rgb_min_0: false,
		ww_min_0: false,
		set_color_magic_bytes: [0x00, 0x0f],
		wait_for_reply: false
	},
});

var commands = {
	"help": {
		desc: "Prints this message",
		fn: help
	},
	"list_types": {
		desc: "Lists the different characteristic types",
		fn: list_types
	},
	"discover": {
		desc: "Discover Magic Home controllers in the network",
		fn: discover
	},
	"turnon": {
		desc: "Turns a light on",
		fn: turnon,
		args: ["ip", "type"]
	},
	"turnoff": {
		desc: "Turns a light off",
		fn: turnoff,
		args: ["ip", "type"]
	},
	"setcolor": {
		desc: "Sets the color of a light",
		fn: setcolor,
		args: ["ip", "red", "green", "blue", "type"]
	},
	"setpattern": {
		desc: "Makes the light display a pattern. The speed parameter has to be in the range 0 - 100",
		fn: setpattern,
		args: ["ip", "pattern", "speed"]
	},
	"list_patterns": {
		desc: "Gives a list of all available built-in patterns",
		fn: list_patterns
	},
	"query": {
		desc: "Gets the current state of the light in JSON format",
		fn: query(false),
		args: ["ip"]
	},
	"query_nice": {
		desc: "Gets the current state of the lights in formatted JSON for better readability",
		fn: query(true),
		args: ["ip"]
	}
}

if(process.argv.length <= 2) {
	help();
	process.exit();
}

var command = commands[process.argv[2]];
if(command == undefined) {
	console.log('Invalid command "' + process.argv[2] + '"');
	console.log();
	help();
	process.exit();
}

var args = process.argv.slice(3);
if(command.args != undefined && args.length < command.args.length) {
	console.log("Missing parameters");
	process.exit();
}

command.fn.apply(this, args);

/*
 * Command functions
 */

function list_types() {
	console.log("Available types:")
	console.log();

	for(let type in characteristics) {
		console.log(type + ":");
		console.log("----------------------");

		var c = characteristics[type];

		console.log("RGB minimum value is 0:", c.rgb_min_0);
		console.log("Warm White minimum value is 0:", c.ww_min_0);
		console.log("Last two magic bytes in color command:", c.set_color_magic_bytes.reduce((aggr, val) => {
			return aggr + ("00" + val.toString(16)).substr(-2);
		}, ""));
		console.log("Wait for reply from controller:", c.wait_for_reply);

		console.log();
	}
}

function list_patterns() {
	console.log("Available patterns:")
	console.log();

	for(let pattern in patterns) {
		console.log(pattern);
	}
}

function discover() {
	var d = new MHDiscovery();

	d.scan(1000, function(err, devices) {
		if(err) return console.log("Error:", err.message);

		console.log("Discovered the following devices:");
		console.log();
		console.log("Address    \t| ID         \t| Model");
		console.log("---------------------------------------");

		for(let device of devices) {
			console.log(`${device.address}\t| ${device.id}\t| ${device.model}`);
		}
	});
}

function query(formatted) {
	return function(ip) {
		var c = new MHControl(ip);

		c.queryState(function(err, state) {
			if(err) return console.log("Error:", err.message);

			if(formatted) {
				console.log(JSON.stringify(state, null, 4));
			} else {
				console.log(JSON.stringify(state));
			}
		});
	};
}

function setpattern(ip, pattern, speed, type) {
	if(type == undefined) type = "type1";
	var chars = characteristics[type];

	var c = new MHControl(ip, chars);

	c.setPattern(pattern, speed, function(err, success) {
		if(err) return console.log("Error:", err.message);
		console.log((success) ? "success" : "failed");
	});
}

function setcolor(ip, r, g, b, type) {
	if(type == undefined) type = "type1";
	var chars = characteristics[type];

	var c = new MHControl(ip, chars);

	c.setColor(r, g, b, function(err, success) {
		if(err) return console.log("Error:", err.message);
		console.log((success) ? "success" : "failed");
	});
}

function turnon(ip, type) {
	if(type == undefined) type = "type1";
	var chars = characteristics[type];

	var c = new MHControl(ip, chars);

	c.turnOn(function(err, success) {
		if(err) return console.log("Error:", err.message);
		console.log((success) ? "success" : "failed");
	});
}

function turnoff(ip, type) {
	if(type == undefined) type = "type1";
	var chars = characteristics[type];

	var c = new MHControl(ip, chars);

	c.turnOff(function(err, success) {
		if(err) return console.log("Error:", err.message);
		console.log((success) ? "success" : "failed");
	});
}

function help() {
	console.log("Available commands:")
	console.log();

	for(let command in commands) {
		var str = command;

		if(commands[command].args != undefined) {
			str += "(" + commands[command].args.reduce((all, arg) => (all + ", " + arg)) + ") ";
		} else {
			str += "() ";
		}

		str += commands[command].desc;
		console.log(str);
	}

	console.log();
	console.log("Example command:");
	console.log();
	console.log('node test.js turnon "192.168.1.100"');
}
