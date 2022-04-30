#!/usr/bin/env node

const { Control, Discovery, ControlAddressable } = require('./index');

const program = require('commander');

program
	.version(require('./package.json').version)
	.option('--bytes', "Output all received bytes", false)
	.option('-Q, --quiet', "Suppress output", false)
	.option('-T, --timeout [timeout]', "Connection timeout in milliseconds", null)
	.option('-C, --cmd-timeout [timeout]', "Command timeout in milliseconds", 1000)
	.option('--masks', "Use byte masks when setting colors", false)
	.option('--cw_support', "Enable support for setting the cold white values", false)
	.option('-A, --ack <mask>', "Wait for replies by setting a bitmask. Bits: 1=power 2=color 3=pattern 4=custom_pattern. Set to 15 to wait for all.", Control.ackMask, 0)
	.option('-a, --addressable', "Use the Addressable protocol instead of the normal one", false);

program.command("discover")
	.description("Discover devices on the network")
	.action(() => discover(false));

program.command("discover_json")
	.description("Discover devices on the network and output result as JSON")
	.action(() => discover(true));

program.command("list_patterns")
	.description("Returns a list of all built-in patterns")
	.action(list_patterns);

program.command("turnon <ip>")
	.alias("on")
	.description("Turn controller on")
	.action(mode_proxy(turnon, turnon_a));

program.command("turnoff <ip>")
	.alias("off")
	.description("Turn controller off")
	.action(mode_proxy(turnoff, turnoff_a));

program.command("setcolor <ip> <red> <green> <blue>")
	.alias("color")
	.description("Set the color")
	.action(mode_proxy(setrgb, setrgb_a));

program.command("setrgbw <ip> <red> <green> <blue> <ww>")
	.alias("rgbw")
	.description("Set the color and warm white values")
	.action(mode_proxy(setrgbw, not_found));

program.command("setrgbww <ip> <red> <green> <blue> <ww> <cw>")
	.alias("rgbww")
	.description("Set the color and warm and cold white values")
	.action(mode_proxy(setrgbww, not_found));

program.command("setwarmwhite <ip> <ww>")
	.alias("ww")
	.description("Set the warm white value")
	.action(mode_proxy(setww, not_found));

program.command("setwhites <ip> <ww> <cw>")
	.alias("whites")
	.description("Set the warm and cold white value")
	.action(mode_proxy(setwhites, not_found));

program.command("setpattern <ip> <pattern> <speed>")
	.alias("pattern")
	.description("Activate a built-in pattern")
	.action(mode_proxy(setpattern, not_found));

program.command("setiapattern <ip> <code> <speed>")
	.alias("iapattern")
	.description("Activate a built-in individually addressable pattern")
	.action(mode_proxy(setiapattern, not_found));

program.command("query <ip>")
	.description("Query state of the controller and return result as JSON")
	.action(mode_proxy(
		function(ip, options) { query(ip, options, false) },
		function(ip, options) { query_a(ip, options, false) },
	));

program.command("query_nice <ip>")
	.description("Query state of the controller and return result as formatted JSON")
	.action(mode_proxy(
		function(ip, options) { query(ip, options, false) },
		function(ip, options) { query_a(ip, options, false) },
	));

program.parse(process.argv);

if (process.argv.length < 3) {
	program.help();
}

function mode_proxy(command_fn, addressable_command_fn) {
	return function() {
		const options = arguments[arguments.length - 1];

		if (options.parent.addressable) {
			return addressable_command_fn.apply(null, arguments);
		} else {
			return command_fn.apply(null, arguments);
		}
	}
}

function not_found() {
	console.log("This command is not available for addressable controllers");
	process.exit(1);
}

/*
 * Command functions
 */

function list_patterns() {
	console.log("Available patterns:");
	console.log();

	for(let pattern of Control.patternNames) {
		console.log(pattern);
	}
}

function discover(json_output) {
	Discovery.scan(1000).then(devices => {
		if (json_output) {
			console.log(JSON.stringify(devices));
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
}

function query(ip, options, formatted) {
	const c = new Control(ip, getOptions(options.parent));

	c.queryState().then(state => {
		if(formatted) {
			console.log(JSON.stringify(state, null, 4));
		} else {
			console.log(JSON.stringify(state));
		}
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function query_a(ip, options, formatted) {
	const c = new ControlAddressable(ip, getOptions_a(options.parent));

	c.queryState().then(state => {
		if(formatted) {
			console.log(JSON.stringify(state, null, 4));
		} else {
			console.log(JSON.stringify(state));
		}
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function setpattern(ip, pattern, speed, options) {
	const c = new Control(ip, getOptions(options.parent));

	console.log(speed);

	c.setPattern(pattern, speed).then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function setiapattern(ip, code, speed, options) {
	const c = new Control(ip, getOptions(options.parent));

	c.setIAPattern(Number(code), speed).then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function setrgbww(ip, r, g, b, ww, cw, options) {
	const c = new Control(ip, getOptions(options.parent));

	c.setColorAndWhites(r, g, b, ww, cw).then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function setrgbw(ip, r, g, b, ww, options) {
	const c = new Control(ip, getOptions(options.parent));

	c.setColorAndWarmWhite(r, g, b, ww).then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function setrgb(ip, r, g, b, options) {
	const c = new Control(ip, getOptions(options.parent));

	c.setColor(r, g, b).then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function setrgb_a(ip, r, g, b, options) {
	const c = new ControlAddressable(ip, getOptions_a(options.parent));

	c.setColor(r, g, b).then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function setww(ip, ww, options) {
	const c = new Control(ip, getOptions(options.parent));

	c.setWarmWhite(ww).then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function setwhites(ip, ww, cw, options) {
	const c = new Control(ip, getOptions(options.parent));

	c.setWhites(ww, cw).then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function turnon(ip, options) {
	const c = new Control(ip, getOptions(options.parent));

	c.turnOn().then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function turnon_a(ip, options) {
	const c = new ControlAddressable(ip, getOptions_a(options.parent));

	c.turnOn().then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function turnoff(ip, options) {
	const c = new Control(ip, getOptions(options.parent));

	c.turnOff().then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function turnoff_a(ip, options) {
	const c = new ControlAddressable(ip, getOptions_a(options.parent));

	c.turnOff().then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function getOptions(options) {
	const cmd_timeout = (options.cmdTimeout === "null") ? null : options.cmdTimeout;

	return {
		log_all_received: options.bytes === true,
		apply_masks: options.masks === true,
		ack: options.ack,
		connect_timeout: options.timeout,
		command_timeout: cmd_timeout,
		cold_white_support: options.cw_support === true,
	};
}

function getOptions_a(options) {
	const cmd_timeout = (options.cmdTimeout === "null") ? null : options.cmdTimeout;

	return {
		log_all_received: options.bytes === true,
		connect_timeout: options.timeout,
		command_timeout: cmd_timeout,
	};
}