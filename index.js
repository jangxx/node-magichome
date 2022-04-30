const Control = require('./lib/Control');
const ControlAddressable = require("./lib/ControlAddressable");
const Discovery = require('./lib/Discovery');
const CustomMode = require('./lib/CustomMode');
const { EffectTimingHelper } = require('./lib/AsyncEffectInterface');
const { AddressableColorStopMode, SingleSegmentsMode } = require("./lib/AddressableMultiColorMode");
const { AddressableCustomModeStep } = require("./lib/AddressableCustomModeStep");

module.exports = {
	Control,
	ControlAddressable,
	Discovery,
	CustomMode,
	EffectTimingHelper,
	AddressableColorStopMode,
	SingleSegmentsMode,
	AddressableCustomModeStep,
};
