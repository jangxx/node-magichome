class AddressableCustomModeStep {
    constructor() {
        this._effect = 1;
        this._foreground = { red: 0, green: 0, blue: 0 };
        this._background = { red: 0, green: 0, blue: 0 };
        this._segmentation = false;
        this._leftDirection = false;
        this._speed = 50;
    }   

    /**
     * Set the effect of this mode step
     * @param {number} effect Number of the effect between 1 and 33
     * @returns {AddressableCustomModeStep}
     */
    setEffect(effect) {
        if (effect < 1 || effect > 33) {
            throw new Error("Effect number out of range");
        }
        this._effect = effect;

        return this;
    }

    /**
     * Sets the foreground color of the effect
     * @param {number} red 
     * @param {number} green 
     * @param {number} blue 
     * @returns {AddressableCustomModeStep}
     */
    setForegroundColor(red, green, blue) {
        this._foreground.red = red;
        this._foreground.green = green;
        this._foreground.blue = blue;
        return this;
    }

    /**
     * Sets the background color of the effect
     * @param {number} red 
     * @param {number} green 
     * @param {number} blue 
     * @returns {AddressableCustomModeStep}
     */
    setBackgroundColor(red, green, blue) {
        this._background.red = red;
        this._background.green = green;
        this._background.blue = blue;
        return this;
    }

    /**
     * Sets the "segmentation" setting
     * @param {boolean} segmentation 
     * @returns {AddressableCustomModeStep}
     */
    setSegmentation(segmentation) {
        this._segmentation = !!segmentation;
        return this;
    }

    /**
     * Sets the direction of the effect. False for right, true for left.
     * @param {boolean} left 
     * @returns {AddressableCustomModeStep}
     */
    setDirection(left) {
        this._leftDirection = !!left;
        return this;
    }

    /**
     * Sets the speed of the effect between 0 and 100
     * @param {number} speed 
     * @returns {AddressableCustomModeStep}
     */
    setSpeed(speed) {
        if (speed < 0 || speed > 100) {
            throw new Error("Speed out of range");
        }
        this._speed = speed;
        return this;
    }
}

module.exports = { AddressableCustomModeStep };