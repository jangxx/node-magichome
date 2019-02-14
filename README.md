# Magic Home for Node

Functionality ported from https://github.com/beville/flux_led to Node.js.

# Features
Control lights which are usually controlled with [this app](https://itunes.apple.com/us/app/magic-home-wifi/id944574066?mt=8) with Node.

**Control**: Turn lights on and off. Set colors. Start effects. Make programmatic effects.  
**Discovery**: Discover lights on the network.  
**CustomMode**: Install custom effects (color fade, jump or strobe) with up to 16 colors.

# Installation

```
npm install magic-home
```

You can also install the library globally with `npm i -g magic-home`. This gives you access to the Magic Home command line utility, aptly named `magic-home`. Run 

```
$ magic-home help
``` 
to get a list of commands.

# Usage

Simple example:

```javascript
const { Control } = require('magic-home');

let light = new Control("192.168.1.100");
light.setPower(true).then(success => {
	// do something with the result
});
```

Simple discovery example:

```javascript
const { Discovery } = require('magic-home');

let discovery = new Discovery();
discovery.scan(500).then(devices => {
	//do something with the result
});
```

More examples are in `cli.js` and the examples directory.

# Methods

## Control

All methods return a promise which resolves to the specific value.  
Each method has an optional callback parameter as well. All of these callbacks will be called with `(err, value)`.

**Control.patternNames**  
Returns the hard-coded list of supported patterns as an array.

**constructor**(address, options)  
Creates a new instance of the API. This does not connect to the light yet.  
Accepted options:
- `wait_for_reply` Whether to wait for a reply from the controller or not. Some controllers acknowledge commands and some don't, so this option has to be found out by trial-and-error (Default: true).
- `log_all_received` Log all received data to the console for debug purposes (Default: false).

**setPower**(on)  
Turns a light either on or off

**turnOn**(callback)

**turnOff**(callback)

**setColorAndWarmWhite**(red, green, blue, ww, callback)  
Sets both color and warm white value at the same time.

**setColor**(red, green, blue, callback)  
Convenience method to only set the color values.
Because the command has to include both color and warm white values, previously seen warm white values will be sent together with the color values.

**setWarmWhite**(ww, callback)  
Convenience method to only set the warm white value.
Because the command has to include both color and warm white values, previously seen color values will be sent together with the warm white value.

**setColorWithBrightness**(red, green, blue, brightness, callback)  
Convenience method to automatically scale down the rgb values to match the brightness parameter (0 - 100).
This method uses _setColor()_ internally, so it could set the warm white value to something unexpected.

**setPattern**(pattern, speed, callback)  
Sets the light to play a built-in pattern. The `pattern` parameter is a string which indicates the pattern (complete list below). The speed parameter has to be between 0 and 100.

**setCustomPattern**(pattern, speed, callback)  
Sets the light to play a custom pattern, defined with the `CustomMode` (see below). An example can be found in examples/custom_mode_test.js. The speed parameter has to be between 0 and 100.

**queryState**(callback)  
Gets the state of the light. Example state:

```javascript
{
	"on": true,
	"mode": "color", // color, custom, special, or one of the built-in patterns
	"speed": 50, // playback speed of the current pattern
	"color": {
		"red": 255,
		"green": 0,
		"blue": 255
	},
	"warm_white": 0,
	"cold_white": 0 // some controllers support this values, but there is currently no way to set it with this library
}
```

**startEffectMode**(callback)  
Start the effect mode. In this mode, a single connection will be kept open, instead of reconnecting for every command. This method resolves to the `EffectInterface` (documented below) once the persistent connection to the controller is established. An example can be found in examples/effect_test.js. This can be used to replicate the music visualization from the app for example.

## EffectInterface

An instance of this class is obtained by calling `startEffectMode`.

**start**(interval_function)  
Starts the effect mode. The `interval_function` will be called every time the last command has been fully processed. It will be called without any parameters.

**setColor**(red, green, blue)  
This method is only supposed to be called from within the `interval_function`. Sets the color.

**delay**(milliseconds)  
This method is only supposed to be called from within the `interval_function`. Calling this method, will lead to the next call to the interval function to happen after the specified time.

**stop**()  
Closes the connection to the light and leads to the interval function not being called anymore.

## Discovery

**constructor**()  
Creates a new instance of the Discovery Mode. This does not send anything yet.

**scan**(timeout, callback)  
Broadcasts a discovery packet to the network and then waits `timeout` milliseconds for a reply from the controllers. The devices are returned in an array of objects like this:

```javascript
{
	address: "<ip address>",
	id: "<12 character ID>",
	model: "<Model number>"
}
```

## CustomMode

All methods in this class can be chained together.

**constructor**()

**addColor**(red, green blue)  
Appends the specified color to the list of colors in the effect.

**addColorList**(list)  
Appends multiple colors at once.
The list needs to have the format `[ [r1, g1, b1], [r2, g2, b2], ...]`

**setTransitionType**(type)  
Set the type of the transition to be either `fade`, `jump`, or `strobe`.

# Built-in patterns

	seven_color_cross_fade
	red_gradual_change
	green_gradual_change
	blue_gradual_change
	yellow_gradual_change
	cyan_gradual_change
	purple_gradual_change
	white_gradual_change
	red_green_cross_fade
	red_blue_cross_fade
	green_blue_cross_fade
	seven_color_strobe_flash
	red_strobe_flash
	green_strobe_flash
	blue_stobe_flash
	yellow_strobe_flash
	cyan_strobe_flash
	purple_strobe_flash
	white_strobe_flash
	seven_color_jumping
