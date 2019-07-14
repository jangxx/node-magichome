#!/usr/bin/env node

const { Control, Discovery } = require('./index');

const program = require('commander');

program
	.version(require('./package.json').version)
	.option('--bytes', "Output all received bytes", false)
	.option('-Q, --quiet', "Suppress output", false)
	.option('--masks', "Use byte masks when setting colors", false)
	.option('-A, --ack <mask>', "Wait for replies by setting a bitmask. Bits: 1=power 2=color 3=pattern 4=custom_pattern. Set to 15 to wait for all.", Control.ackMask, 0);

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
	.action(turnon);

program.command("turnoff <ip>")
	.alias("off")
	.description("Turn controller off")
	.action(turnoff);

program.command("setcolor <ip> <red> <green> <blue>")
	.alias("color")
	.description("Set the color")
	.action(setrgb);

program.command("setrgbw <ip> <red> <green> <blue> <ww>")
	.alias("rgbw")
	.description("Set the color and warm white values")
	.action(setrgbw);

program.command("setwarmwhite <ip> <ww>")
	.alias("ww")
	.description("Set the warm white value")
	.action(setww);

program.command("setpattern <ip> <pattern> <speed>")
	.alias("pattern")
	.description("Activate a built-in pattern")
	.action(setpattern);

program.command("query <ip>")
	.description("Query state of the controller and return result as JSON")
	.action((ip, options) => query(ip, options, false));

program.command("query_nice <ip>")
	.description("Query state of the controller and return result as formatted JSON")
	.action((ip, options) => query(ip, options, true));

program.parse(process.argv);

if (process.argv.length < 3) {
	program.help();
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

function setpattern(ip, pattern, speed, options) {
	const c = new Control(ip, getOptions(options.parent));

	console.log(speed);

	c.setPattern(pattern, speed).then(success => {
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

function setww(ip, ww, options) {
	const c = new Control(ip, getOptions(options.parent));

	c.setWarmWhite(ww).then(success => {
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

function turnoff(ip, options) {
	const c = new Control(ip, getOptions(options.parent));

	c.turnOff().then(success => {
		if (!options.quiet) console.log((success) ? "success" : "failed");
	}).catch(err => {
		return console.log("Error:", err.message);
	});
}

function getOptions(options) {
	return {
		log_all_received: options.bytes === true,
		apply_masks: options.masks === true,
		ack: options.ack
	};
}