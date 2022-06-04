
module.exports.PORT = 5577;

const versionMatch = process.versions.node.match(/(\d+)\.(\d+)\.(\d+)/);

module.exports.NODE_VERSION = Object.freeze({
    major: Number(versionMatch[1]),
    minor: Number(versionMatch[2]),
    patch: Number(versionMatch[3]),
});