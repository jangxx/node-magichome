const { ControlAddressable, AddressableMultiColorMode } = require("../");

const controller = new ControlAddressable("192.168.0.65", { log_add_received: true, command_timeout: 2000 });

const mode = new AddressableMultiColorMode(50);
mode.setEffect("breathing");

for (let i = 0; i < 30; i++) {
    switch (i % 3) {
        case 0:
            mode.addColorStop(i, 255, 0, 0);
            break;
        case 1:
            mode.addColorStop(i, 0, 255, 0);
            break;
        case 2:
            mode.addColorStop(i, 0, 0, 255);
            break;
    }
}

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
}

main().then(() => {}, err => console.error(err));