const EFFECT_MAP = {
    static: 1,
    running_water: 2,
    strobe: 3,
    jump: 4,
    breathing: 5,
};

class AddressableMultiColorModeBase {
    /**
     * Creates a new addressable multi color mode, which uses color stops
     * @param {number} length Number of "points" on the strip (can be determined with queryDeviceConfig())
     */
    constructor(length) {
        this._length = length;
        this._effect = 1; // static
        this._speed = 100;
    }

    _getColors() {
        throw new Error("Not implemented");
    }

    /**
     * Set the effect of this mode. Returns the instance for easy chainability.
     * @param {string} effect_name Name of the effect, either "static", "running_water", "strobe", "jump" or "breathing"
     * @returns {AddressableMultiColorMode}
     */
    setEffect(effect_name) {
        if (!(effect_name in EFFECT_MAP)) {
            throw new Error(`'${effect_name}' is not a valid effect`);
        }

        this._effect = EFFECT_MAP[effect_name];
        return this;
    }

    /**
     * Set the speed of this mode. Returns the instance for easy chainability.
     * @param {number} speed Speed of the mode between 0 (static) and 100
     * @returns {AddressableMultiColorMode}
     */
    setSpeed(speed) {
        this._speed = Math.min(100, Math.max(0, Math.round(speed)));
        return this;
    }
}

class AddressableColorStopMode extends AddressableMultiColorModeBase {
    constructor(length) {
        super(length);

        this._colorStops = { 0: [ 0, 0, 0 ] };
    }

    _getColors() {
        const colors = [];

        let currentColor;

        for (let i = 0; i < this._length; i++) {
            if (this._colorStops[i] !== undefined) {
                currentColor = this._colorStops[i];
            }

            colors.push(currentColor);
        }

        return colors;
    }

    /**
     * Add a color stop to this mode. This will set the point with the index start and all following LEDs to this color
     * @param {number} start
     * @param {number} red 
     * @param {number} green 
     * @param {number} blue 
     * @returns {AddressableColorStopMode}
     */
     addColorStop(start, red, green, blue) {
        if (start >= this._length || start < 0) {
            throw new Error("Start value is out of range");
        }

        this._colorStops[start] = [ red, green, blue ];
        return this;
    }
}

class SingleSegmentsMode extends AddressableMultiColorModeBase {
    /**
     * Create a new single segments mode
     * @param {number} length Number of segments ("points") on the strip
     * @param {Object} backgroundColor Initial color of all LEDs on the strip
     * @param {number} backgroundColor.red
     * @param {number} backgroundColor.green
     * @param {number} backgroundColor.blue
     */
    constructor(length, backgroundColor = { red: 0, green: 0, blue: 0 }) {
        super(length);

        this._colors = new Array(this._length).fill(null).map(() => [ backgroundColor.red, backgroundColor.green, backgroundColor.blue ]);
    }

    _getColors() {
        return this._colors;
    }

    /**
     * Set the color of a single segment ("point") on the strip
     * @param {number} position Index of the point
     * @param {number} red 
     * @param {number} green 
     * @param {number} blue 
     * @returns {SingleSegmentsMode}
     */
    setPointColor(position, red, green, blue) {
        if (position >= this._length || position < 0) {
            throw new Error("Position is out of range");
        }

        this._colors[position][0] = red;
        this._colors[position][1] = green;
        this._colors[position][2] = blue;

        return this;
    }
}

// TODO: add a gradient mode of some sort

module.exports = { AddressableColorStopMode, SingleSegmentsMode, AddressableMultiColorModeBase };