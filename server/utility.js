const config = require("./config.js");
const globals = require("./globals.js");

//sends a message to all connected cubiix, except for the excluded one.
function sendToAll(message, excluded = null) {
	globals.cubiixList.forEach(function(cubiix) {
		if (cubiix != excluded) {
			cubiix.socket.send(message);
		}
	});
}
module.exports.sendToAll = sendToAll;

//create a cubiix's full name
function fullName(cubiix) {
	sameNamedCubiix = globals.cubiixList.filter(cbx => {
		return cbx.name == cubiix.name;
	});
	
	return cubiix.name + (sameNamedCubiix.length > 1? "#" + cubiix.id : "");
}
module.exports.fullName = fullName;

//put cubiix at spawn point
function respawn(cubiix, initialSpawn = false) {
	if (!initialSpawn) {
		unstackCubiix(cubiix);
	}
	let chosenSpawn = config.spawnPoints[Math.floor(Math.random() * config.spawnPoints.length)];
	cubiix.posX = chosenSpawn.x + Math.random() * chosenSpawn.sizeX - chosenSpawn.sizeX / 2;
	cubiix.posY = chosenSpawn.y + Math.random() * chosenSpawn.sizeY - chosenSpawn.sizeY / 2;
	
	if (!initialSpawn) {
		sendToAll("[p]" + cubiix.id + "|" + cubiix.posX + "|" + cubiix.posY);
	}
}
module.exports.respawn = respawn;

//check if a cubiix has the specified permission
function hasPerms(cubiix, permission) {
	return cubiix.perms.includes(permission) || cubiix.perms.includes("admin");
}
module.exports.hasPerms = hasPerms;

//gets the distance between a cubiix and a point.
function cubiixPointDist(cubiix, x, y) {
	return Math.sqrt((cubiix.posX - x) * (cubiix.posX - x) + (cubiix.posY - y) * (cubiix.posY - y));
}
module.exports.cubiixPointDist = cubiixPointDist;

//gets the distance between two cubiix.
function cubiixDist(cubiixA, cubiixB) {
	return Math.sqrt((cubiixA.posX - cubiixB.posX) * (cubiixA.posX - cubiixB.posX) + (cubiixA.posY - cubiixB.posY) * (cubiixA.posY - cubiixB.posY));
}
module.exports.cubiixDist = cubiixDist;

//gets the cubiix that is closest to targetCubiix.
function closestCubiix(targetCubiix) {
	let closest = null;
	globals.cubiixList.forEach(cubiix => {
		if (cubiix == targetCubiix || cubiix.stackedOn) return;
		if (!closest) {
			closest = cubiix;
			return;
		}
		if (cubiixDist(targetCubiix, cubiix) < cubiixDist(targetCubiix, closest)) {
			closest = cubiix;
		}
	});
	return closest;
}
module.exports.closestCubiix = closestCubiix;

//gets the very bottom cubiix in a stack, given any cubiix from that stack.
function bottomCubiixInStack(cubiix) {
	if (cubiix.stackedOn) {
		return bottomCubiixInStack(cubiix.stackedOn);
	}
	return cubiix;
}
module.exports.bottomCubiixInStack = bottomCubiixInStack;

//gets the very top cubiix in a stack, given any cubiix from that stack.
function topCubiixInStack(cubiix) {
	if (cubiix.nextInStack) {
		return topCubiixInStack(cubiix.nextInStack);
	}
	return cubiix;
}
module.exports.topCubiixInStack = topCubiixInStack;

//takes a cubiix and all other cubiix above it out of a stack. 
function unstackCubiix(cubiix) {
	recursiveUnstack(cubiix);
	sendToAll("[unstack]" + cubiix.id);
}
module.exports.unstackCubiix = unstackCubiix;

function recursiveUnstack(cubiix) {
	//remove cubiix from the one below itself.
	if (cubiix.stackedOn) {
		cubiix.stackedOn.nextInStack = null;
		cubiix.stackedOn = null;
	}
	
	//unstack the next one above it.
	if (cubiix.nextInStack) {
		recursiveUnstack(cubiix.nextInStack);
	}
}

//finds a cubiix by its fully specified name. (name#id)
function cubiixFromId(id) {
	return globals.cubiixList.find(cubiix => {
		return "#" + cubiix.id == id;
	});
}
module.exports.cubiixFromId = cubiixFromId;

//sets a cubiix's position and the position of all other cubiix stacked on top of it.
function setCubiixPos(cubiix, x, y) {
	cubiix.posX = x;
	cubiix.posY = y;
	if (cubiix.nextInStack) {
		setCubiixPos(cubiix.nextInStack, x, y);
	}
}
module.exports.setCubiixPos = setCubiixPos;

//serializes the map into a string
function serializeMap() {
	let mapString = "";
	for (let i = 0; i < config.mapHeight; i++) {
		mapString += globals.worldMap[i].join("|") + "|";
	}
	return mapString.substring(0, mapString.length - 1);
}
module.exports.serializeMap = serializeMap;