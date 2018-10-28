# Magic Home for Node

Functionality ported from https://github.com/beville/flux_led to Node.js.

# Features
Control lights which are usually controlled with [this app](https://itunes.apple.com/us/app/magic-home-wifi/id944574066?mt=8) with Node.

**Control**: Turn lights on and off. Set colors. Start effects. Make programmatic effects.  
**Discovery**: Discover lights on the network.  
**CustomMode**: Install custom effects (color fade, jump or strobe) with up to 16 colors **(Not implemented yet)**  

# Installation

```
npm install magic-home
```

# Usage

Simple example:

```javascript
var MagicHomeControl = require('magic-home').Control;

var light = new MagicHomeControl("192.168.1.100");
light.turnOn(function(err, success) {
	//do something with the result
});
```

Simple discovery example:

```javascript
var MagicHomeDiscovery = require('magic-home').Discovery;

var discovery = new MagicHomeDiscovery();
discovery.scan(500, function(err, devices) {
	//do something with the result
});
```

More examples are in the test directory.


# Methods

## Control

**constructor**(address, characteristics)  
Creates a new instance of the API. This does not connect to the light yet.  
The parameter `characteristics` gives the API some important hints about the behavior of the connected LED controller, like if they acknowledge commands or the format of the data to change the colors. Two sets of characteristics are defined in `test/cli.js`, but unfortunately these parameters have to be found out through trial and error. If the parameter is left undefined, the assumptions found in https://github.com/beville/flux_led are used.

**turnOn**(callback)

**turnOff**(callback)

**setColor**(red, green, blue, callback)

**setWarmWhite**(ww, callback)

**setColorAndWarmWhite**(red, green, blue, ww, callback)

**setColorWithBrightness**(red, green, blue, brightness, callback)  
Convenience method to automatically scale down the rgb values to match the brightness parameter

**setPattern**(pattern, speed, callback)  
Sets the light to play a built-in pattern. The `pattern` parameter is a string which indicates the pattern (complete list below). The speed parameter has to be between 0 and 100.

**queryState**(callback)  
Gets the state of the light. Example state:

```javascript
{
	"on": true,
	"mode": "color", //color, warm_white, custom, special, or one of the built-in patterns
	"speed": 50, //playback speed of the current pattern
	"color": {
		"red": 255,
		"green": 0,
		"blue": 255
	},
	"warm_white": 0
}
```

**startEffectMode**(callback)  
Start the effect mode. In this mode, a single connection will be kept open, instead of reconnecting for every command. The callback gets called with one parameter, which is the `EffectInterface` (documented below). An example can be found in test/effect_test.js.

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
Broadcasts a discovery packet to the network and then waits `timeout` milliseconds for a reply from the controllers. The callback will be called with `(err, devices)` where `devices` is an array of objects like this:

```javascript
{
	address: "<ip address>",
	id: "<12 character ID>",
	model: "<Model number>"
}
```

This method returns a Promise which resolves to the aforementioned devices array as well.

## CustomMode

**Not implemented yet**

# Pattern list

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
