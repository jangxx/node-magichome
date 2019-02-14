#!/usr/bin/env node

const { Control: MHControl, Discovery: MHDiscovery } = require('./index');

var commands = {
	"help": {
		desc: "Prints this message",
		fn: help
	},
	"discover": {
		desc: "Discover Magic Home controllers in the network",
		fn: discover
	},
	"turnon": {
		desc: "Turns a light on",
		fn: turnon,
		args: ["ip"]
	},
	"turnoff": {
		desc: "Turns a light off",
		fn: turnoff,
		args: ["ip"]
	},
	"setcolor": {
		desc: "Sets the color of a light",
		fn: setcolor,
		args: ["ip", "red", "green", "blue"]
	},
	"setrgbw": {
		desc: "Sets the color of a light as well as the warm white value",
		fn: setcolor,
		args: ["ip", "red", "green", "blue", "ww"]
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

function list_patterns() {
	console.log("Available patterns:")
	console.log();

	for(let pattern of MHControl.patternNames) {
		console.log(pattern);
	}
}

function discover() {
	MHDiscovery.scan(1000).then(devices => {
		console.log("Discovered the following devices:");
		console.log();
		console.log("Address    \t| ID         \t| Model");
		console.log("---------------------------------------");

		for(let device of devices) {
			console.log(`${device.address}\t| ${device.id}\t| ${device.model}`);
		}
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function query(formatted) {
	return function(ip) {
		var c = new MHControl(ip, { wait_for_reply: false });

		c.queryState().then(state => {
			if(formatted) {
				console.log(JSON.stringify(state, null, 4));
			} else {
				console.log(JSON.stringify(state));
			}
		}).catch(err => {
			return console.log("Error:", err.message);
		});
	};
}

function setpattern(ip, pattern, speed) {
	var c = new MHControl(ip, { wait_for_reply: false });

	c.setPattern(pattern, speed).then(success => {
		console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function setcolor(ip, r, g, b, ww) {
	var c = new MHControl(ip, { wait_for_reply: false });

	c.setColorAndWarmWhite(r, g, b, ww).then(success => {
		console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function turnon(ip) {
	var c = new MHControl(ip, { wait_for_reply: false });

	c.turnOn().then(success => {
		console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function turnoff(ip) {
	var c = new MHControl(ip, { wait_for_reply: false });

	c.turnOff().then(success => {
		console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
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
	console.log('magic-home turnon "192.168.1.100"');
}
