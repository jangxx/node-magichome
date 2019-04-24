#!/usr/bin/env node

const { Control: MHControl, Discovery: MHDiscovery } = require('./index');

const commands = {
	"help": {
		desc: "Prints this message",
		fn: help
	},
	"discover": {
		desc: "Discover Magic Home controllers on the network",
		fn: discover(false)
	},
	"discover_json": {
		desc: "Discover Magic Home controllers and output the result as JSON",
		fn: discover(true)
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
		fn: (ip, r, g, b, flags) => setrgbw(ip, r, g, b, 0, flags),
		args: ["ip", "red", "green", "blue"]
	},
	"setrgbw": {
		desc: "Sets the color of a light as well as the warm white value",
		fn: setrgbw,
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
};

const flags = {
	wait: "Wait for replies",
	bytes: "Output all received bytes",
	quiet: "Surpress output"
};

if (process.argv.length <= 2) {
	help();
	process.exit();
}

const command = commands[process.argv[2]];
if (command == undefined) {
	console.log('Invalid command "' + process.argv[2] + '"');
	console.log();
	help();
	process.exit();
}

let args = process.argv.slice(3);
let additional_args = [];

if (command.args != undefined) {
	if (args.length < command.args.length) {
		console.log("Missing parameters");
		process.exit();
	}

	if (args.length > command.args.length) {
		additional_args = args.slice(command.args.length); // add all arguments after the required ones
	}
	
	args = args.slice(0, command.args.length).concat([ parseFlags(additional_args) ]);
}
command.fn.apply(this, args);

/*
 * Command functions
 */

function list_patterns() {
	console.log("Available patterns:");
	console.log();

	for(let pattern of MHControl.patternNames) {
		console.log(pattern);
	}
}

function discover(json_output) {
	return function() {
		MHDiscovery.scan(1000).then(devices => {
			if (json_output) {
				console.log(devices);
			} else {
				console.log("Discovered the following devices:");
				console.log();
				console.log("Address    \t| ID         \t| Model");
				console.log("---------------------------------------");
	
				for(let device of devices) {
					console.log(`${device.address}\t| ${device.id}\t| ${device.model}`);
				}
			}
			
		}).catch(err => {
			return console.log("Error:", err.message);
		});
	};
}

function query(formatted) {
	return function(ip, flags) {
		const c = new MHControl(ip, getOptions(flags));

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

function setpattern(ip, pattern, speed, flags) {
	const c = new MHControl(ip, getOptions(flags));

	c.setPattern(pattern, speed).then(success => {
		if (!flags.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function setrgbw(ip, r, g, b, ww, flags) {
	const c = new MHControl(ip, getOptions(flags));

	c.setColorAndWarmWhite(r, g, b, ww).then(success => {
		if (!flags.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function turnon(ip, flags) {
	const c = new MHControl(ip, getOptions(flags));

	c.turnOn().then(success => {
		if (!flags.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function turnoff(ip, flags) {
	const c = new MHControl(ip, getOptions(flags));

	c.turnOff().then(success => {
		if (!flags.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function help() {
	console.log("Available commands:");
	console.log();

	for(let command in commands) {
		let str = command;

		if(commands[command].args != undefined) {
			str += commands[command].args.reduce((all, arg) => (all + " <" + arg + ">"), "") + " ";
		} else {
			str += " ";
		}

		console.log(str);
		console.log("    " + commands[command].desc);
	}
	console.log();
	
	console.log("Available flags (do not work with every command):");
	console.log();

	for (let flag in flags) {
		console.log(`--${flag}: ${flags[flag]}`);
	}
	console.log();

	console.log("Example command:");
	console.log();
	console.log('magic-home turnon "192.168.1.100" --bytes');
}

function parseFlags(args) {
	let resultFlags = {};
	let flagNames = Object.keys(flags);
	for(let flag of flagNames) {
		resultFlags[flag] = false;
	}

	for(let arg of args) {
		for(let flag of flagNames) {
			if (arg == `--${flag}`) {
				resultFlags[flag] = true;
			}
		}
	}

	return resultFlags;
}

function getOptions(flags) {
	return {
		wait_for_reply: flags.wait,
		log_all_received: flags.bytes,
	};
}