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
$ magic-home
``` 
to get a list of commands and options.

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
	// do something with the result
});
```

More examples are in `cli.js` and the examples directory.

# Methods

## Control

All methods return a promise which resolves to the specific value.  
Each method has an optional callback parameter as well. All of these callbacks will be called with `(err, value)`.

*static get* **patternNames**  
Returns the hard-coded list of supported patterns as an array.

*static* **ackMask**(mask)  
Create an `ack` option object by supplying a bitmask with the bits representing booleans. Bit 1 = power, Bit 2 = color, Bit 3 = pattern, Bit 4 = custom_pattern.  
Example: `Control.ackMask(1)` would set `power` to `true` and all other values to `false`.

**constructor**(address, options)  
Creates a new instance of the API. This does not connect to the light yet.  
Accepted options:
- `ack` An object of the form `{ power: true, color: true, pattern: true, custom_pattern: true }` indicating for which types of command an acknowledging response is expected. Some controllers acknowledge some commands and others don't, so this option has to be found out by trial-and-error.
Check out [the wiki](https://github.com/jangxx/node-magichome/wiki/Understanding-the-ack-parameter) for more information about this parameter.
You can use the `Control.ackMask(mask)` static function for convenience to set all options with less code.
- `log_all_received` Log all received data to the console for debug purposes. (Default: false)
- `apply_masks` Set a special mask bit in the `setColor` and `setWarmWhite` methods, which is required for some controllers, which can't set both values at the same time, like bulbs for example.
This value is automatically set to `true` if `queryState` detects a controller of type `0x25`, `0x35` or `0x44`. (Default: false)
- `connect_timeout` Duration in milliseconds after which a controller will be regarded as non-reachable, if a connection can not be established.
Normally, this should be handled by your OS and you get an _EHOSTUNREACH_ error, but this allows you to set a custom timeout yourself. (Default: null _[No timeout/let the OS handle it]_)
- `command_timeout` Duration in milliseconds after which the library will consider an acknowledged command as lost. Set to `null` to disable the timeout. (Default: 1000)
- `cold_white_support` Enable support for changing cold white values. Only enable this if your controller actually supports it, otherwise you won't be able to change the colors.
This value is automatically set to `true` if `queryState` detects a controller of type `0x35`. (Default: false)
- `wait_for_reply` **[Deprecated, use ack option instead]**

**setPower**(on, callback)  
Turns a light either on or off.

**turnOn**(callback)  
Convenience method to call `setPower(true)`.

**turnOff**(callback)  
Convenience method to call `setPower(false)`.

**setColorAndWarmWhite**(red, green, blue, ww, callback)  
Sets both color and warm white value at the same time. 
This method will not work on lights that don't support both colors and whites being activated at the same time; use either `setColor` or `setWarmWhite`.

**setColorAndWhites**(red, green, blue, ww, cw, callback)  
Sets color, warm white as well as cold white values at the same time, if `cold_white_support` is enabled. 
This method will not work on lights that don't support both colors and whites being being activated at the same time; use either `setColor` or `setWhites`.

**setColor**(red, green, blue, callback)  
Sets only the color values.
Because the command has to include both color and white values, previously seen white values will be sent together with the color values, if masks are not enabled.

**setWarmWhite**(ww, callback)  
Set only the the warm white value.
Because the command has to include both color and white values, previously seen color and cold white values will be sent together with the warm white value, if masks are not enabled.

**setWhites**(ww, cw, callback)  
Set only the warm and cold white values.
Because the command has to include both color and white values, previously seen color values will be sent together with the white values, if masks are not enabled.

**setColorWithBrightness**(red, green, blue, brightness, callback)  
Convenience method to automatically scale down the rgb values to match the brightness parameter (0 - 100).
This method uses `setColor()` internally, so it could set the warm white value to something unexpected.

**setPattern**(pattern, speed, callback)  
Sets the light to play a built-in pattern. The `pattern` parameter is a string which indicates the pattern (complete list below). The speed parameter has to be between 0 and 100.

**setCustomPattern**(pattern, speed, callback)  
Sets the light to play a custom pattern, defined with the `CustomMode` (see below). An example can be found in _examples/custom_mode_test.js_. The speed parameter has to be between 0 and 100.

**setIAPattern**(code, speed, callback)  
Sets the light to a pattern where each LED has it's own animation. The code has to be between 1 and 300 and the speed parameter has to be between 0 and 100. Only works for controllers which connect to a strip of individually adressable LEDs (e.g. WS2812B).

**queryState**(callback)  
Gets the state of the light. Example state:

```javascript
{
	type: 0x33, // can also be 0x04, 0x25 or 0x81 according to the python library
	on: true,
	mode: "color", // color, custom, special, pattern, ia_pattern
	pattern: null // number of the ia_pattern (mode == "ia_pattern"), name of pattern (mode == "pattern") or null
	speed: 50, // playback speed of the current pattern
	color: {
		red: 255,
		green: 0,
		blue: 255
	},
	warm_white: 0,
	cold_white: 0 // some controllers support this value, but you can only set if when cold_white_support is enabled
}
```

**startEffectMode**(callback)  
**[Deprecated, use getAsyncEffectMode instead]**

**getAsyncEffectMode**()  
Returns a instance of the async effect interface `AsyncEffectInterface` (documented below).
This interface allows the creation of effects which constantly update the controller by sending data over a single persistent connection, which can be used to replicate the music visualization from the app for example.
The returned interface does not connect to the controller immediately.
An example can be found in _examples/async_effect_test.js_.

## ControlAddressable

This class implements the new version 3 of the addressable protocol, in order to control controllers such as `AK001-ZJ2148` and the like.
Because the interface it basically completely different, all of this functionality is not rolled into the `Control` class, but into this one instead.

**constructor**(address, options)  
Creates a new instance of the API. This does not connect to the light yet.  
Accepted options:
- `log_all_received` Log all received data to the console for debug purposes. (Default: false)
- `connect_timeout` Duration in milliseconds after which a controller will be regarded as non-reachable, if a connection can not be established.
Normally, this should be handled by your OS and you get an _EHOSTUNREACH_ error, but this allows you to set a custom timeout yourself. (Default: null _[No timeout/let the OS handle it]_)
- `command_timeout` Duration in milliseconds after which the library will consider an acknowledged command as lost. Set to `null` to disable the timeout. (Default: 1000)

**setPower**(on)  
Turns the controller either on or off.

**turnOn**()  
Convenience method to call `setPower(true)`.

**turnOff**()  
Convenience method to call `setPower(false)`.

**queryState**()  
Gets the state of the controller. Example state:

```javascript
{
	type: 0xA3, // can also be other values
	on: true,
	mode: "fixed", // "fixed", "rbm", "custom", "multi", "music"
	effect: 1, // depending on the mode either the numeric or string identifier of the current effect
	speed: 50, // playback speed of the current effect
	color: {
		red: 255,
		green: 0,
		blue: 255
	},
	warm_white: 0,
}
```

**queryDeviceConfig**()  
Gets the config of the controller, i.e. the configured number of LEDs, LED type, etc. Example config:

```javascript
{
	pixel_count: 50,
	segments: 3,
	ic_type: 'SM16703',
	led_order: 'GBR',
	pixel_count_music: 50,
	segments_music: 3
}
```

**setFixedMode**(options)  
Sets the "fixed mode" of the controller. This includes all the options of the "Fixed" tab of the app.
Every field of the options object is optional, but if nothing is set, the controller will be set to all black, which is probably not an intended state.  
Accepted options:

- `effect`: A number between 1 and 10 indiciating the effect with 1 being a static color.
- `speed`: A number between 1 and 100 controlling the speed of the effect.
- `foreground`: An object of the form `{ red, green, blue }` controlling the "foreground" color of the effect.
- `background`: An object of the form `{ red, green, blue }` controlling the "background" color of the effect (not available for all effects).
- `reversed`: Play the effect in reverse (not available for all effects).

**setColor**(red, green, blue)  
Convenience method to set the controller to a fixed and static mode with a single color.

**setRbmMode**(mode, brightness, speed)  
I'm still not sure what "Rbm" is supposed to stand for, but it's what the app calls it and so it's what the library calls it.
Essentially this function allows to select one of 100 preprogrammed effects (`mode` parameter) and play them with an adjustable brightness and at adjustable speed (both between 1 and 100).

**setMultiColorMode**(mode)  
This method takes an `AddressableMultiColorModeBase` object (see below) and makes the controller display it.
This is used to control individual segments on the strip for example.

**setCustomMode**(steps)  
This method takes an array of `AddressableCustomModeStep` objects (see below) and makes the controller display them as a custom mode.

## EffectInterface
**[Deprecated, use AsyncEffectInterface instead]**

## AsyncEffectInterface

An instance of this class is obtained by calling `getAsyncEffectMode`.

_get_ **connected**  
Boolean property indicating the current connection status.

_get/set_ **userData**  
This property is just an empty object that you can use to pass arbitrary data to the effect function.

**connect**()  
Establish a connection to the controller.
The method returns a promise that resolves once the connection has been established.

**start**(interval_function)  
Starts the effect with the supplied function.
The `interval_function` will be asynchronously called (awaited) forever in a loop, until `stop()` is called.
The supplied function should therefore either be declared `async` or return a Promise.
It will be called with a reference to the `AsyncEffectInterface`.

**end**()  
Stops any remaining effects and closes the connection to the controller.

**stop**()  
Calling this method will stop the execution of the `interval_function` at the next async call it performs, stopping the effect.
The connection to the controller will not be severed though - a call to `end()` is still neccessary.

**delay**(milliseconds)  
This method is only supposed to be called (awaited) from within the `interval_function`. 
Calling this method, will delay execution of the effect function for the given amount of time.

### Color setting methods

All the color setting methods

- **setColorAndWarmWhite**
- **setColorAndWhites**
- **setColor**
- **setWarmWhite**
- **setWhites**

function essentially the same as their counterparts on the `Control` class, with the key difference that they do not take a callback argument and that they should only be called (awaited) from within the `interval_function`.

## AddressableMultiColorModeBase
This is the base class for multiple different multi color effects that mimic the functionality of the Magic Home app.
All of these methods return the class instance for easy chainability.

**setEffect**(effect_name)  
Set the effect of this mode to one of "static", "running_water", "strobe", "jump" or "breathing".

**setSpeed**(speed)  
Set the effect speed between 0 and 100.

## AddressableColorStopMode
This mode is comparable to the color stop multi color mode from the app.
The whole strip is colored according to color stops which set the color of their own position as well as all subsequent ones until the next color stop is hit.
If you wanted to set a strip with 50 segments to be red on the first 25 segments and blue on the remaining 25 segments you would create the mode like this:

```javascript
const mode = new AddressableColorStopMode(50)
	.addColorStop(0, 255, 0, 0)
	.addColorStop(25, 0, 0, 255);
```

All of these methods return the class instance for easy chainability.

**constructor**(length)  
Create a new `AddressableColorStopMode` instance for a strip with _length_ LEDs on it.

**addColorStop**(start, red, green, blue)  
Add a new color stop starting at position _start_.

## SingleSegmentsMode
This mode allows to control individual segments (or "points") on an LED strip.

All of these methods return the class instance for easy chainability.

**constructor**(length, backgroundColor)  
Create a new `SingleSegmentsMode` instance for a strip with _length_ LEDs on it and with each segment set to _backgroundColor_ (default: `{ red: 0, green: 0, blue: 0}`).

**setPointColor**(position, red, green, blue)  
Set the color of a single segment on the LED strip.

## AddressableCustomModeStep
This class represents a single step in a custom mode, which is made up of up to 32 of these steps played in order.
Each method returns the class instance so that they can be chained together.

**setEffect**(effect)  
Sets the effect index between 1 and 33.

**setForegroundColor**(red, green, blue)  
Sets the foreground color of this effect.

**setBackgroundColor**(red, green, blue)  
Sets the background color of this effect. The background color is not used on all of the effects.

**setSegmentation**(segmentation)  
Sets the "segmentation" setting, even though I'm not sure what this actually does.

**setDirection**(left)  
Control the direction of the effect, with `false` corresponding to right and `true` corresponding to left.

**setSpeed**(speed)  
Set the speed of the effect between 0 and 100.

## Discovery

*static* **scan(timeout)**  
This static method can be used for convenience when the list of clients does not need to be stored within the `Discovery` instance and when the callback parameter is not needed.

**constructor**()  
Creates a new instance of the Discovery Mode. This does not perform the actual scan yet.

**scan**(timeout, callback)  
Broadcasts a discovery packet to the network and then waits `timeout` milliseconds for a reply from the controllers. The devices are returned in an array of objects like this:

```javascript
{
	address: "<ip address>",
	id: "<12 character ID>",
	model: "<Model number>"
}
```

_get_ **clients**  
Contains the list of clients returned in the last call to `scan()`.

_get_ **scanned**  
Boolean value indicating if `scan()` has already been called on this instance.


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

## EffectTimingHelper

This utility class simplifies the timing within the effect function of the `AsyncEffectInterface`.

**constructor**(parent)  
Creates and binds the helper to an instance of an `AsyncEffectInterface`.

**start**()  
Sets the current time as the start time of the effect.

**isStarted**()  
Returns true if the start time was set.

**delayRemaining**(milliseconds)  
Delays the effect is such a way that the next command will be called the given amount of time from the start of the effect.
This also sets the start time to the current time.

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

# Troubleshooting

### My promises don't resolve

https://github.com/jangxx/node-magichome/wiki/Understanding-the-ack-parameter

### My promises always reject with a "Command timed out" error

https://github.com/jangxx/node-magichome/wiki/Understanding-the-ack-parameter

