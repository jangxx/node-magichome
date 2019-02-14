function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

class CustomMode {
	constructor() {
		this._colors = [];
		this._transition_type = "fade";
	}

	static get transitionTypes() {
		return [ "fade", "jump", "strobe" ];
	}

	get transitionType() {
		return this._transition_type;
	}

	get colors() {
		return this._colors;
	}

	/**
	 * Add a new color to the effect
	 * @param {Number} red 
	 * @param {Number} green 
	 * @param {Number} blue
	 * @returns {CustomMode} This object for chainability
	 */
	addColor(red, green, blue) {
		if (this._colors.length >= 16) {
			throw new Error("Too many colors (max 16)");
		}

		this._colors.push({
			red: clamp(red, 0, 255), 
			green: clamp(green, 0, 255), 
			blue: clamp(blue, 0, 255) 
		});
		
		return this;
	}
	
	/**
	 * Add a list of colors all at once
	 * @param {Array} list Each element should contain and array of the form [ red, green, blue ]
	 * @returns {CustomMode} This object for chainability
	 */
	addColorList(list) {
		if (this._colors.length + list.length >= 16) {
			throw new Error("Too many colors (max 16)");
		}

		for(let color of list) {
			this.addColor(color[0], color[1], color[2]);
		}
		return this;
	}

	setTransitionType(type) {
		if (!CustomMode.transitionTypes.includes(type)) {
			throw new Error("Invalid type");
		}

		this._transition_type = type;
		return this;
	}
}

module.exports = CustomMode;
