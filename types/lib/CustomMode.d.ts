export = CustomMode;

declare enum TransitionType {
    FADE = "fade",
    JUMP = "jump",
    STROBE = "strobe"
}

declare class CustomMode {
    static get transitionTypes(): string[];
    get transitionType(): TransitionType;
    get colors(): number[];
    /**
     * Add a new color to the effect
     * @param {Number} red
     * @param {Number} green
     * @param {Number} blue
     * @returns {CustomMode} This object for chainability
     */
    addColor(red: number, green: number, blue: number): CustomMode;
    /**
     * Add a list of colors all at once
     * @param {Array} list Each element should contain and array of the form [ red, green, blue ]
     * @returns {CustomMode} This object for chainability
     */
    addColorList(list: number[]): CustomMode;
    /**
	 * Set the mode to use one of three possible transition types (found in CustomMode.transitionTypes)
	 * @param {TransitionType} type 
	 * @returns 
	 */
    setTransitionType(type: TransitionType): CustomMode;
}

declare namespace CustomMode {
    export { TransitionType }
}