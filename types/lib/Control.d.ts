export = Control;
declare class Control {
    static get patternNames(): string[];
    static ackMask(mask: number): {
        power: boolean;
        color: boolean;
        pattern: boolean;
        custom_pattern: boolean;
    };
    /**
     * Create a new Control instance. This does not connect to the controller, yet.
     * @param {String} address IP or hostname of the controller
     * @param {Object} options
     * @param {boolean} options.wait_for_reply [Deprecated] Wait for the controllers to send data as acknowledgement. (Default: true)
     * @param {boolean} options.log_all_received Print all received bytes into stdout for debug purposes (Default: false)
     * @param {boolean} options.apply_masks Set the mask bit in setColor and setWarmWhite (Default: false)
     * @param {boolean} options.cold_white_support Send a different version of the color change packets, which also set the cold white values (Default: false)
     * @param {Number} options.connect_timeout Duration in milliseconds after which the connection attempt will be cancelled if the connection can not be established (Default: null [No timeout])
     * @param {Number} options.command_timeout Duration in milliseconds after which an acknowledged command will be regarded as failed. Set to null to disable. (Default: 1000)
     * @param {Object} options.ack
     * @param {boolean} options.ack.power Wait for controller to send data to achnowledge power change commands (Default: true)
     * @param {boolean} options.ack.color Wait for controller to send data to achnowledge color change commands (Default: true)
     * @param {boolean} options.ack.pattern Wait for controller to send data to achnowledge built-in pattern change commands (Default: true)
     * @param {boolean} options.ack.custom_pattern Wait for controller to send data to acknowledge custom pattern change commands (Default: true)
     */
    constructor(address: string, options?: Partial<{
        wait_for_reply: boolean;
        log_all_received: boolean;
        apply_masks: boolean;
        cold_white_support: boolean;
        connect_timeout: number;
        command_timeout: number;
        ack: Partial<{
            power: boolean;
            color: boolean;
            pattern: boolean;
            custom_pattern: boolean;
        }>;
    }>);
    /**
     * Sets the power state either to on or off
     * @param {Boolean} on
     * @param {function} callback called with (err, success)
     * @returns {Promise<boolean>}
     */
    setPower(on: boolean, callback?: Function): Promise<boolean>;
    /**
     * Convenience method to call setPower(true)
     * @param {function} callback
     * @returns {Promise<boolean>}
     */
    turnOn(callback?: Function): Promise<boolean>;
    /**
     * Convenience method to call setPower(false)
     * @param {function} callback
     * @returns {Promise<boolean>}
     */
    turnOff(callback?: Function): Promise<boolean>;
    /**
     * Sets the color and warm white values of the controller.
     * Also saves the values for further calls to setColor, setWarmWhite, etc
     * @param {Number} red
     * @param {Number} green
     * @param {Number} blue
     * @param {Number} ww
     * @param {function} callback called with (err, success)
     * @returns {Promise<boolean>}
     */
    setColorAndWarmWhite(red: number, green: number, blue: number, ww: number, callback?: Function): Promise<boolean>;
    /**
     * Sets the color and white values of the controller.
     * Also saves the values for further calls to setColor, setWarmWhite, etc
     * @param {Number} red
     * @param {Number} green
     * @param {Number} blue
     * @param {Number} ww warm white
     * @param {Number} cw cold white
     * @param {function} callback called with (err, success)
     * @returns {Promise<boolean>}
     */
    setColorAndWhites(red: number, green: number, blue: number, ww: number, cw: number, callback?: Function): Promise<boolean>;
    /**
     * Sets the color values of the controller.
     * Depending on apply_masks, only the color values, or color values as well as previous warm white values will be sent
     * @param {Number} red
     * @param {Number} green
     * @param {Number} blue
     * @param {function} callback called with (err, success)
     * @returns {Promise<boolean>}
     */
    setColor(red: number, green: number, blue: number, callback?: Function): Promise<boolean>;
    /**
     * Sets the warm white values of the controller.
     * Depending on apply_masks, only the warm white values, or warm white values as well as previous color values will be sent
     * @param {Number} ww
     * @param {function} callback called with (err, success)
     * @returns {Promise<boolean>}
     */
    setWarmWhite(ww: number, callback?: Function): Promise<boolean>;
    /**
     * Sets the white values of the controller.
     * Depending on apply_masks, only the cold white values, or cold white values as well as previous color values will be sent
     * @param {Number} ww warm white
     * @param {Number} cw cold white
     * @param {function} callback called with (err, success)
     * @returns {Promise<boolean>}
     */
    setWhites(ww: number, cw: number, callback?: Function): Promise<boolean>;
    /**
     * Convenience method to scale down the colors with a brightness value between 0 and 100
     * If you send red, green and blue to 0, this sets the color to white with the specified brightness (but not warm white!)
     * @param {Number} red
     * @param {Number} green
     * @param {Number} blue
     * @param {Number} brightness
     * @param {function} callback
     * @returns {Promise<boolean>}
     */
    setColorWithBrightness(red: number, green: number, blue: number, brightness: number, callback?: Function): Promise<boolean>;
    /**
     * Sets the controller to display one of the predefined patterns
     * @param {String} pattern Name of the pattern
     * @param {Number} speed between 0 and 100
     * @param {function} callback
     * @returns {Promise<boolean>}
     */
    setPattern(pattern: string, speed: number, callback?: Function): Promise<boolean>;
    /**
     * Sets the controller to display one of the predefined patterns
     * @param {Number} code Code of the pattern, between 1 and 300
     * @param {Number} speed between 0 and 100
     * @param {function} callback
     * @returns {Promise<boolean>}
     */
    setIAPattern(code: number, speed: number, callback?: Function): Promise<boolean>;
    /**
     * Sets the controller to display a custom pattern
     * @param {CustomMode} pattern
     * @param {Number} speed
     * @param {function} callback
     * @returns {Promise<boolean>}
     */
    setCustomPattern(pattern: CustomMode, speed: number, callback?: Function): Promise<boolean>;
    /**
     * @deprecated Creates a new EffectInterface, which establishes a persistent connection to the controller
     * @param {function} callback
     * @returns {Promise<EffectInterface>}
     */
    startEffectMode(callback?: Function): Promise<EffectInterface>;
    /**
	 * Get a new instance of the AsyncEffectInterface, which is used to create and drive a persistent connection to
	 * the controller in order to create dynamic effects
	 * @returns {AsyncEffectInterface}
	 */
    getAsyncEffectMode(): AsyncEffectInterface;
    /**
     * Queries the controller for it's current state
     * This method stores the color and ww values for future calls to setColor, setWarmWhite, etc.
     * It will also set apply_masks to true for controllers which require it.
     * @param {function} callback
     * @returns {Promise<QueryResponse>}
     */
    queryState(callback?: Function): Promise<QueryResponse>;
}
declare namespace Control {
    export { QueryResponse };
}
import CustomMode = require("./CustomMode");
import EffectInterface = require("./EffectInterface");
import { AsyncEffectInterface } from "./AsyncEffectInterface";
type QueryResponse = {
    type: number;
    on: boolean;
    mode: string;
    speed: number;
    color: {
        red: number;
        green: number;
        blue: number;
    };
    warm_white: number;
    cold_white: number;
};
