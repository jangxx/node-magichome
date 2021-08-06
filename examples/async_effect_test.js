const { Control, EffectTimingHelper } = require("../");

const ip = process.argv[2];
const ackMask = (process.argv.length > 2) ? process.argv[3] : 0;

if(ip == undefined) {
	console.log("Usage: node async_effect_test.js <ip> [ackMask]");
	console.log();
	console.log("Demonstrates the use of the async effect interface, by showing a simple interval function which changes the color roughly twice a second");
	process.exit();
}

const control = new Control(ip, { ack: Control.ackMask(ackMask) });

const effectMode = control.getAsyncEffectMode();

effectMode.connect().then(() => {
    let runs = 0;
    const timingHelper = new EffectTimingHelper(effectMode);

    return effectMode.start(async function(ctx) {
        // this is an optional feature to simplify the async timing
        if (!timingHelper.isStarted()) {
            timingHelper.start(); // basically "start" the effect. afterwards we are always going to do relative timing
        }

        await ctx.setColor(255, 0, 0);
        await timingHelper.delayRemaining(500); // delay until 500ms since the pinned time have passed
        await ctx.setColor(0, 255, 0);
        await timingHelper.delayRemaining(500);
        await ctx.setColor(0, 0, 255);
        await timingHelper.delayRemaining(500);

        runs += 1;

        if (runs > 20) { // run 20 times then stop
            ctx.stop();
        }
    });
}).catch(err => {
    console.log("Error:", err);
});