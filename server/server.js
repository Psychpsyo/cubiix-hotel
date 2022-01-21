const ws = require("ws");
const fs = require("fs");

const wss = new ws.WebSocketServer({port: 15882});
var cubiixList = [];
var lastId = 0;

//load config file
var config = JSON.parse(fs.readFileSync("config.json"));
//TODO: validate config file

//set up the map. TODO: load from file or so.
var map = [];
for (let i = 0; i < config.mapHeight; i++) {
	map.push([]);
	for (let j = 0; j < config.mapWidth; j++) {
		map[i].push(i % 2? "plankA" : "plankB");
	}
}

//sends a message to all connected cubiix, except for the excluded one.
function sendToAll(message, excluded = null) {
	cubiixList.forEach(function(cubiix) {
		if (cubiix != excluded) {
			cubiix.socket.send(message);
		}
	});
}

wss.on("connection", function connection(ws) {
	//single use event listener to catch the init message from the client.
	ws.addEventListener("message", function(message) {
		let msgType = message.data.substring(1, message.data.indexOf("]"));
		let args = message.data.substring(message.data.indexOf("]") + 1).split("|");
		
		if(msgType == "init") {
			let thisCubiix = {
				posX: config.spawnX,
				posY: config.spawnY,
				//claimed X and Y are used to check if the cubiix has moved to fast (far)
				claimedX: config.spawnX,
				claimedY: config.spawnY,
				walking: false,
				socket: ws,
				id: lastId,
				nextInStack: null,
				stackedOn: null,
				name: args[0],
				nameColor: args[1]
			};
			lastId++;
			
			console.log("Cubiix connected. Assigning id " + thisCubiix.id + ".");
			
			
			//send the new cubiix to all other ones.
			sendToAll("[newCubiix]" + thisCubiix.posX + "|" + thisCubiix.posY + "|" + thisCubiix.walking + "|" + thisCubiix.id + "||" + thisCubiix.name + "|" + thisCubiix.nameColor);
			
			//add new cubiix to the server-side list
			cubiixList.push(thisCubiix);
			
			//send all cubiix to the new one and then tell it that all of them came through
			cubiixList.forEach(function(cubiix) {
				ws.send("[newCubiix]" + cubiix.posX + "|" + cubiix.posY + "|" + cubiix.walking + "|" + cubiix.id + "|" + (cubiix.stackedOn? cubiix.stackedOn.id : "") + "|" + cubiix.name + "|" + cubiix.nameColor);
			});
			ws.send("[allCubiixSent]");
			
			//inform new cubiix about their id
			ws.send("[yourId]" + thisCubiix.id);
			//send map to the new cubiix
			ws.send("[map]" + config.mapWidth + "|" + config.mapHeight + "|" + serializeMap());
			//send movement speed to new cubiix
			ws.send("[walkSpeed]" + config.walkSpeed);
			
			let lastPositionMessage = 0; //timestamp of when the last [p] update came in and the cubiix position was actually changed.
			
			ws.addEventListener("message", function(message) {
				let msgType = message.data.substring(1, message.data.indexOf("]"));
				let args = message.data.substring(message.data.indexOf("]") + 1).split("|");
				
				switch(msgType) {
				case "p":
					let newX = parseFloat(args[0]);
					let newY = parseFloat(args[1]);
					
					//movement speed validation
					if (config.enforceSpeedLimit) {
						thisCubiix.claimedX = newX;
						thisCubiix.claimedY = newY;
						
						clampedDelta = Math.min(process.uptime() - lastPositionMessage, .1); //gets clamped to not allow massive jumps in position after a long while of standing still.
						if (clampedDelta * config.walkSpeed < cubiixPointDist(thisCubiix, newX, newY)) {
							//if so, limit the movement down to the actual limit
							let moveAngle = Math.atan2(newY - thisCubiix.posY, newX - thisCubiix.posX);
							newX = thisCubiix.posX + Math.cos(moveAngle) * config.walkSpeed * clampedDelta;
							newY = thisCubiix.posY + Math.sin(moveAngle) * config.walkSpeed * clampedDelta;
							
							//check if cubiix is too far from where they should be and, if so, reset them locally.
							if (cubiixPointDist(thisCubiix, thisCubiix.claimedX, thisCubiix.claimedY) > 5) {
								ws.send("[p]" + thisCubiix.id + "|" + newX + "|" + newY, thisCubiix);
								console.log("Stop right there, criminal scum! You have violated the law!");
							}
						}
					}
					
					lastPositionMessage = process.uptime();
					if (!thisCubiix.stackedOn) {
						thisCubiix.posX = newX;
						thisCubiix.posY = newY;
						sendToAll("[p]" + thisCubiix.id + "|" + thisCubiix.posX + "|" + thisCubiix.posY, thisCubiix);
						sendToAll("[walk]" + thisCubiix.id + "|true", thisCubiix);
					}
					
					break;
				case "stopWalk":
					thisCubiix.walking = false;
					sendToAll("[walk]" + thisCubiix.id + "|false");
					break;
				case "stack":
					if (thisCubiix.stackedOn) {
						unstackCubiix(thisCubiix);
						break;
					}
					let other = closestCubiix(thisCubiix);
					if (other && cubiixDist(thisCubiix, other) < 32) {
						other = topCubiixInStack(other);
						thisCubiix.stackedOn = other;
						other.nextInStack = thisCubiix;
						sendToAll("[stack]" + thisCubiix.id + "|" + other.id);
					}
					break;
				case "init":
					
					break;
				}
			});
			
			ws.addEventListener("close", function() {
				//unstack the cubiix from its current stack, then remove it from the world
				unstackCubiix(thisCubiix);
				cubiixList.splice(cubiixList.indexOf(thisCubiix), 1);
				sendToAll("[disconnected]" + thisCubiix.id);
				console.log("Cubiix with id " + thisCubiix.id + " disconnected.");
			});
		} else {
			ws.close();
		}
	}, {once: true});
});

//utility functions


//gets the distance between a cubiix and a point.
function cubiixPointDist(cubiix, x, y) {
	return Math.sqrt((cubiix.posX - x) * (cubiix.posX - x) + (cubiix.posY - y) * (cubiix.posY - y));
}

//gets the distance between two cubiix.
function cubiixDist(cubiixA, cubiixB) {
	return Math.sqrt((cubiixA.posX - cubiixB.posX) * (cubiixA.posX - cubiixB.posX) + (cubiixA.posY - cubiixB.posY) * (cubiixA.posY - cubiixB.posY));
}

//gets the cubiix that is closest to targetCubiix.
function closestCubiix(targetCubiix) {
	let closest = null;
	cubiixList.forEach(cubiix => {
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

//gets the very bottom cubiix in a stack, given any cubiix from that stack.
function bottomCubiixInStack(cubiix) {
	if (cubiix.stackedOn) {
		return bottomCubiixInStack(cubiix.stackedOn);
	}
	return cubiix;
}

//gets the very top cubiix in a stack, given any cubiix from that stack.
function topCubiixInStack(cubiix) {
	if (cubiix.nextInStack) {
		return topCubiixInStack(cubiix.nextInStack);
	}
	return cubiix;
}

//takes a cubiix and all other cubiix above it out of a stack. 
function unstackCubiix(cubiix) {
	recursiveUnstack(cubiix);
	sendToAll("[unstack]" + cubiix.id);
}

function recursiveUnstack(cubiix) {
	//move cubiix to where the bottom most stack member is.
	cubiix.posX = bottomCubiixInStack(cubiix).posX;
	cubiix.posY = bottomCubiixInStack(cubiix).posY;
	
	//remove it from the one below itself.
	if (cubiix.stackedOn) {
		cubiix.stackedOn.nextInStack = null;
		cubiix.stackedOn = null;
	}
	
	//unstack the next one above it.
	if (cubiix.nextInStack) {
		unstackCubiix(cubiix.nextInStack);
	}
}

function serializeMap() {
	let mapString = "";
	for (let i = 0; i < config.mapHeight; i++) {
		mapString += map[i].join("|") + "|";
	}
	return mapString.substring(0, mapString.length - 1);
}