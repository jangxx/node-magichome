const Control = require('./lib/Control');
const ControlAddressable = require("./lib/ControlAddressable");
const Discovery = require('./lib/Discovery');
const CustomMode = require('./lib/CustomMode');
const { EffectTimingHelper } = require('./lib/AsyncEffectInterface');
const { AddressableMultiColorMode } = require("./lib/AddressableMultiColorMode");

module.exports = {
	Control,
	ControlAddressable,
	Discovery,
	CustomMode,
	EffectTimingHelper,
	AddressableMultiColorMode,
};
