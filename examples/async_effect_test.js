const { Control, EffectTimingHelper } = require("../");

const ip = process.argv[2];
const ackMask = (process.argv.length > 2) ? process.argv[3] : 0;

if(ip == undefined) {
	console.log("Usage: node async_effect_test.js <ip> [ackMask]");
	console.log();
	console.log("Demonstrates the use of the async effect interface, by showing a simple interval function which changes the color roughly twice a second");
	process.exit();
}

// ctx is just a reference to the effect interface
async function effect(ctx) {
    const { timingHelper } = ctx.userData;

    // this is an optional feature to simplify the async timing
    if (!timingHelper.isStarted()) {
        timingHelper.start(); // basically "start" the effect. afterwards we are always going to do relative timing
    }

    await ctx.setColor(255, 0, 0);
    await timingHelper.delayRemaining(500); // delay until 500ms since the effect was started. this also resets the start time to after the delay is over
    await ctx.setColor(0, 255, 0);
    await timingHelper.delayRemaining(500);
    await ctx.setColor(0, 0, 255);
    await timingHelper.delayRemaining(500);

    ctx.userData.runs += 1;

    if (ctx.userData.runs > 10) { // run 20 times then stop
        ctx.stop(); // this will also prevent the effect function from being called again
    }
}

// async main function so that we can use async/await
async function main() {
    const control = new Control(ip, { ack: Control.ackMask(ackMask) });
    const effectMode = control.getAsyncEffectMode();

    await effectMode.connect(); // connect to controller

    const timingHelper = new EffectTimingHelper(effectMode);

    effectMode.userData.timingHelper = timingHelper;
    effectMode.userData.runs = 0;

    await effectMode.start(effect); // run the effect to completion

    effectMode.end(); // close the connection
}

main().catch(err => {
    console.log("Error:", err);
});