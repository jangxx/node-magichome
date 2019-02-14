const { Control, CustomMode } = require('../');

const ip = process.argv[2];

if(ip == undefined) {
	console.log("Usage: node custom_mode_test.js <ip>");
	console.log();
	console.log("Demostrates the use of the custom modes by setting the controller to a purple - green - red - blue jump effect, which is not one of the included patterns.");
	process.exit();
}

let control = new Control(ip, { wait_for_reply: false});

let my_effect = new CustomMode();

my_effect
	.addColor(255, 0, 255)
	.addColor(0, 255, 0)
	.addColor(255, 0, 0)
	.addColor(0, 0, 255)
	.setTransitionType("jump");

control.setCustomPattern(my_effect, 75).then(success => {
	console.log((success) ? "success" : "failed");
}).catch(err => {
	return console.log("Error:", err.message);
});