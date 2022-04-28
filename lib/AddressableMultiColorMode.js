const EFFECT_MAP = {
    static: 1,
    running_water: 2,
    strobe: 3,
    jump: 4,
    breathing: 5,
};

class AddressableMultiColorMode {
    constructor(length) {
        this._length = length;
        this._effect = 1; // static
        this._speed = 100;

        this._colorStops = {};
    }

    setEffect(effect_name) {
        if (!(effect_name in EFFECT_MAP)) {
            throw new Error(`'${effect_name}' is not a valid effect`);
        }

        this._effect = EFFECT_MAP[effect_name];
    }

    setSpeed(speed) {
        this._speed = Math.min(100, Math.max(0, Math.round(speed)));
    }

    addColorStop(start, red, green, blue) {
        if (start >= this._length) {
            throw new Error("Start value is out of range");
        }

        this._colorStops[start] = { red, green, blue };
    }
}

module.exports = { AddressableMultiColorMode };