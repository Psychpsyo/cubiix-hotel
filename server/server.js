const ws = require("ws");
const fs = require("fs");

const wss = new ws.WebSocketServer({port: 15882});
var cubiixList = [];
var lastId = 0;

//load config file
var config = JSON.parse(fs.readFileSync("config.json"));
if (config.generateAdminPassword) {
	config.adminPassword = String(Math.floor(Math.random() * 10000000)).padStart(8, "0");
	console.log("Generated admin password " + config.adminPassword + " for this session.")
}
//TODO: validate config file

//set up the map. TODO: load from file or so.
var worldMap = [];
for (let i = 0; i < config.mapHeight; i++) {
	worldMap.push([]);
	for (let j = 0; j < config.mapWidth; j++) {
		worldMap[i].push(i % 2? "plankA" : "plankB");
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
				posX: 0,
				posY: 0,
				walking: false,
				socket: ws,
				id: lastId,
				nextInStack: null,
				stackedOn: null,
				name: args.splice(1).join("|"),
				nameColor: args[0],
				perms: config.defaultPermSet
			};
			respawn(thisCubiix, true);
			
			if (config.enforceSpeedLimit) {
				thisCubiix.claimedX = thisCubiix.posX;
				thisCubiix.claimedY = thisCubiix.posY;
			}
			lastId++;
			
			console.log("Cubiix '" + thisCubiix.name + "+" + thisCubiix.id + "' connected.");
			
			//send the new cubiix to all other ones.
			sendToAll("[newCubiix]" + thisCubiix.posX + "|" + thisCubiix.posY + "|" + thisCubiix.walking + "|" + thisCubiix.id + "||" + thisCubiix.nameColor + "|" + thisCubiix.name);
			
			//add new cubiix to the server-side list
			cubiixList.push(thisCubiix);
			
			//send all cubiix to the new one and then tell it that all of them came through
			cubiixList.forEach(function(cubiix) {
				ws.send("[newCubiix]" + cubiix.posX + "|" + cubiix.posY + "|" + cubiix.walking + "|" + cubiix.id + "|" + (cubiix.stackedOn? cubiix.stackedOn.id : "") + "|" + cubiix.nameColor + "|" + cubiix.name);
			});
			ws.send("[allCubiixSent]");
			
			//inform new cubiix about their id
			ws.send("[yourId]" + thisCubiix.id);
			//send map to the new cubiix
			ws.send("[map]" + config.mapWidth + "|" + config.mapHeight + "|" + serializeMap());
			//send movement speed to new cubiix
			ws.send("[walkSpeed]" + config.walkSpeed);
			//tell new cubiix what their perms are
			ws.send("[givePerms]" + thisCubiix.perms.join("|"));
			
			let lastPositionMessage = 0; //timestamp of when the last [p] update came in and the cubiix position was actually changed.
			
			ws.addEventListener("message", function(message) {
				let msgType = message.data.substring(1, message.data.indexOf("]"));
				let args = message.data.substring(message.data.indexOf("]") + 1).split("|");
				
				switch(msgType) {
				case "p":
					if (!hasPerms(thisCubiix, "move")) break;
					let newX = parseFloat(args[0]);
					let newY = parseFloat(args[1]);
					
					//movement speed validation
					if (!hasPerms(thisCubiix, "teleport")) {
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
				case "floor": //the cubiix is attempting to edit a floor tile
					if (!hasPerms(thisCubiix, "floorEdit")) break;
					let x = parseInt(args[0]);
					let y = parseInt(args[1]);
					if (x >= 0 && y >= 0 && x < config.mapWidth && y < config.mapHeight) {
						worldMap[y][x] = args[2];
						sendToAll("[floor]" + args[0] + "|" + args[1] + "|" + args[2], thisCubiix);
					}
					break;
				case "stack":
					if (!hasPerms(thisCubiix, "stack")) break;
					let other = closestCubiix(thisCubiix);
					if (other && cubiixDist(thisCubiix, other) < 32) {
						other = topCubiixInStack(other);
						thisCubiix.stackedOn = other;
						other.nextInStack = thisCubiix;
						sendToAll("[stack]" + thisCubiix.id + "|" + other.id);
					}
					break;
				case "unstack":
					if (!hasPerms(thisCubiix, "unstack")) break;
					if (thisCubiix.stackedOn) {
						unstackCubiix(thisCubiix);
					}
					break;
				case "pickUp":
					if (!hasPerms(thisCubiix, "pickUp")) break;
					let pickedUp = closestCubiix(thisCubiix);
					if (pickedUp && cubiixDist(thisCubiix, pickedUp) < 32) {
						topSelf = topCubiixInStack(thisCubiix); //top cubiix in this stack
						pickedUp.stackedOn = topSelf;
						topSelf.nextInStack = pickedUp;
						sendToAll("[stack]" + pickedUp.id + "|" + topSelf.id);
					}
					break;
				case "drop":
					if (!hasPerms(thisCubiix, "drop")) break;
					if (thisCubiix.nextInStack) {
						sendToAll("[drop]" + thisCubiix.nextInStack.id);
						thisCubiix.nextInStack.posX = bottomCubiixInStack(thisCubiix).posX;
						thisCubiix.nextInStack.posY = bottomCubiixInStack(thisCubiix).posY;
						
						thisCubiix.nextInStack.stackedOn = null;
						thisCubiix.nextInStack = null;
					}
					break;
				case "requestAdmin":
					if (config.adminPassword != "" && args[0] == config.adminPassword) {
						thisCubiix.perms.push("admin");
						ws.send("[givePerms]admin");
						console.log("Cubiix '" + thisCubiix.name + "#" + thisCubiix.id + "' is now admin.");
					}
					break;
				case "chat":
					let chatMessage = args.join("|");
					if (chatMessage[0] == "/") {
						doChatCommand(thisCubiix, chatMessage.substring(1));
						break;
					}
					
					if (!hasPerms(thisCubiix, "chat")) {
						ws.send("[error]You don't have the permission to send chat messages.");
						break;
					}
					
					//otherwise this is a regular chat message
					sendToAll("[chat]" + thisCubiix.id + "|" + chatMessage, thisCubiix);
					break;
				}
			});
			
			ws.addEventListener("close", function() {
				//unstack the cubiix from its current stack, then remove it from the world
				unstackCubiix(thisCubiix);
				cubiixList.splice(cubiixList.indexOf(thisCubiix), 1);
				sendToAll("[disconnected]" + thisCubiix.id);
				console.log("Cubiix '" + thisCubiix.name + "#" + thisCubiix.id + "' disconnected.");
			});
		} else {
			ws.close();
		}
	}, {once: true});
});

//execute a chat command from a user
function doChatCommand(cubiix, command) {
	if (!hasPerms(cubiix, "commands")) {
		cubiix.socket.send("[error]You don't have the permission to run chat commands.");
		return;
	}
	switch (command.substring(0, (command + " ").indexOf(" "))) {
		case "respawn":
			respawn(cubiix);
			break;
		default:
			cubiix.socket.send("[error]Command does not exist.");
	}
}

//utility functions

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

//check if a cubiix has the specified permission
function hasPerms(cubiix, permission) {
	return cubiix.perms.includes(permission) || cubiix.perms.includes("admin");
}

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
		recursiveUnstack(cubiix.nextInStack);
	}
}

function serializeMap() {
	let mapString = "";
	for (let i = 0; i < config.mapHeight; i++) {
		mapString += worldMap[i].join("|") + "|";
	}
	return mapString.substring(0, mapString.length - 1);
}