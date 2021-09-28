export = CustomMode;
declare class CustomMode {
    static get transitionTypes(): string[];
    get transitionType(): string;
    get colors(): any[];
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
    addColorList(list: any[]): CustomMode;
    setTransitionType(type: any): CustomMode;
}
