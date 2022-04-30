const { ControlAddressable, AddressableColorStopMode, SingleSegmentsMode, AddressableCustomModeStep } = require("../");

const controller = new ControlAddressable("192.168.0.65", { log_add_received: true, command_timeout: 2000 });

// const steps = [
//     (new AddressableCustomModeStep())
//         .setEffect(2)
//         .setForegroundColor(255,0,0)
//         .setBackgroundColor(0,255,0)
// ];

// const mode = new SingleSegmentsMode(50);
// mode.setPointColor(5, 255, 0, 0);
// mode.setPointColor(25, 255, 0, 0);

const mode = new AddressableColorStopMode(50);
mode.addColorStop(10, 255, 0, 0);
mode.addColorStop(40, 0, 0, 255);

async function main() {
    // await controller.turnOn();

    // await controller.setIAPattern(20, 50);

    // await controller.setFixedMode({
    //     effect: 1,
    //     foreground: { green: 255, },
    //     // background: { red: 255 },
    //     speed: 100,
    //     // reversed: true,
    // });

    // await controller.setRbmMode(2);

    await controller.setMultiColorMode(mode);
    // await controller.setCustomMode(steps);
    // console.log(await controller.queryDeviceConfig());
    // console.log(await controller.setColor(0, 255, 0));
}

main().then(() => {}, err => console.error(err));