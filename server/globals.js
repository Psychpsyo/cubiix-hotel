const config = require("./config.js");

module.exports.cubiixList = [];

//set up the map. TODO: load from file or so.
module.exports.worldMap = [];
for (let i = 0; i < config.mapHeight; i++) {
	module.exports.worldMap.push([]);
	for (let j = 0; j < config.mapWidth; j++) {
		module.exports.worldMap[i].push(i % 2? "plankA" : "plankB");
	}
}