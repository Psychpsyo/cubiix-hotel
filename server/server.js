const ws = require("ws");

const utility = require("./utility.js");
const config = require("./config.js");
const globals = require("./globals.js");
const commands = require("./commands.js");

const wss = new ws.WebSocketServer({port: 15882});
var lastId = 0;

wss.on("connection", function connection(ws) {
	//single use event listener to catch the init message from the client.
	ws.addEventListener("message", function(message) {
		let msgType = message.data.substring(1, message.data.indexOf("]"));
		let args = message.data.substring(message.data.indexOf("]") + 1).split("|");
		
		if(msgType == "init") {
			//check if init is valid
			if (args.length < 2 || args.slice(1).join("|") == "") {
				ws.send("[kick]Error while joining the server.");
				ws.close();
			}
			//check if the user is IP banned
			if (config.bannedIPs.includes(ws._socket.remoteAddress)) {
				ws.send("[kick]You are banned from this server.");
				ws.close();
				return;
			}
			//check user limit
			if (globals.cubiixList.length >= config.userLimit && config.userLimit >= 0) {
				ws.send("[kick]This server has reached its user limit.");
				ws.close();
				return;
			}
			
			let thisCubiix = {
				posX: 0,
				posY: 0,
				walking: false,
				socket: ws,
				id: lastId,
				nextInStack: null,
				stackedOn: null,
				name: args.splice(1).join("|").trim(),
				nameColor: args[0],
				perms: config.defaultPermSet.slice()
			};
			utility.respawn(thisCubiix, true);
			
			if (config.enforceSpeedLimit) {
				thisCubiix.claimedX = thisCubiix.posX;
				thisCubiix.claimedY = thisCubiix.posY;
			}
			lastId++;
			
			//send the new cubiix to all other ones.
			utility.sendToAll("[newCubiix]" + thisCubiix.posX + "|" + thisCubiix.posY + "|" + thisCubiix.walking + "|" + thisCubiix.id + "||" + thisCubiix.nameColor + "|" + thisCubiix.name);
			
			//add new cubiix to the server-side list
			globals.cubiixList.push(thisCubiix);
			
			//welcome the new cubiix
			if (config.joinMessage != "") {
				ws.send("[note]" + config.joinMessage.replace("{player}", thisCubiix.name));
			}
			
			//announce join after the cubiix has been added to the list of cubiix so that, if a same named cubiix is already on the server, the new one will show with ther #id in the join messages.
			if (config.announceJoinLeave) {
				utility.sendToAll("[note]" + utility.fullName(thisCubiix) + " has connected.", thisCubiix);
			}
			console.log("Cubiix '" + utility.fullName(thisCubiix) + "' connected.");
			
			//send all cubiix to the new one and then tell it that all of them came through
			globals.cubiixList.forEach(function(cubiix) {
				ws.send("[newCubiix]" + cubiix.posX + "|" + cubiix.posY + "|" + cubiix.walking + "|" + cubiix.id + "|" + (cubiix.stackedOn? cubiix.stackedOn.id : "") + "|" + cubiix.nameColor + "|" + cubiix.name);
			});
			ws.send("[allCubiixSent]");
			
			//inform new cubiix about their id
			ws.send("[yourId]" + thisCubiix.id);
			//send map to the new cubiix
			ws.send("[map]" + config.mapWidth + "|" + config.mapHeight + "|" + utility.serializeMap());
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
					if (!utility.hasPerms(thisCubiix, "move")) break;
					let newX = parseFloat(args[0]);
					let newY = parseFloat(args[1]);
					
					//movement speed validation
					if (!utility.hasPerms(thisCubiix, "teleport")) {
						thisCubiix.claimedX = newX;
						thisCubiix.claimedY = newY;
						
						clampedDelta = Math.min(process.uptime() - lastPositionMessage, .1); //gets clamped to not allow massive jumps in position after a long while of standing still.
						if (clampedDelta * config.walkSpeed < utility.cubiixPointDist(thisCubiix, newX, newY)) {
							//if so, limit the movement down to the actual limit
							let moveAngle = Math.atan2(newY - thisCubiix.posY, newX - thisCubiix.posX);
							newX = thisCubiix.posX + Math.cos(moveAngle) * config.walkSpeed * clampedDelta;
							newY = thisCubiix.posY + Math.sin(moveAngle) * config.walkSpeed * clampedDelta;
							
							//check if cubiix is too far from where they should be and, if so, reset them locally.
							if (utility.cubiixPointDist(thisCubiix, thisCubiix.claimedX, thisCubiix.claimedY) > 5) {
								ws.send("[p]" + thisCubiix.id + "|" + newX + "|" + newY, thisCubiix);
							}
						}
					}
					
					lastPositionMessage = process.uptime();
					if (!thisCubiix.stackedOn) {
						utility.setCubiixPos(thisCubiix, newX, newY);
						utility.sendToAll("[p]" + thisCubiix.id + "|" + thisCubiix.posX + "|" + thisCubiix.posY, thisCubiix);
						utility.sendToAll("[walk]" + thisCubiix.id + "|true", thisCubiix);
					}
					
					break;
				case "stopWalk":
					thisCubiix.walking = false;
					utility.sendToAll("[walk]" + thisCubiix.id + "|false");
					break;
				case "floor": //the cubiix is attempting to edit a floor tile
					if (!hasPerms(thisCubiix, "floorEdit")) break;
					let x = parseInt(args[0]);
					let y = parseInt(args[1]);
					if (x >= 0 && y >= 0 && x < config.mapWidth && y < config.mapHeight) {
						globals.worldMap[y][x] = args[2];
						utility.sendToAll("[floor]" + args[0] + "|" + args[1] + "|" + args[2], thisCubiix);
					}
					break;
				case "stack":
					if (!utility.hasPerms(thisCubiix, "stack")) break;
					let other = utility.closestCubiix(thisCubiix);
					if (other && utility.cubiixDist(thisCubiix, other) < 32) {
						other = utility.topCubiixInStack(other);
						thisCubiix.stackedOn = other;
						other.nextInStack = thisCubiix;
						utility.sendToAll("[stack]" + thisCubiix.id + "|" + other.id);
						utility.setCubiixPos(thisCubiix, other.posX, other.posY);
					}
					break;
				case "unstack":
					if (!utility.hasPerms(thisCubiix, "unstack")) break;
					if (thisCubiix.stackedOn) {
						utility.unstackCubiix(thisCubiix);
					}
					break;
				case "pickUp":
					if (!utility.hasPerms(thisCubiix, "pickUp")) break;
					let pickedUp = utility.closestCubiix(thisCubiix);
					if (pickedUp && utility.cubiixDist(thisCubiix, pickedUp) < 32) {
						topSelf = utility.topCubiixInStack(thisCubiix); //top cubiix in this stack
						pickedUp.stackedOn = topSelf;
						topSelf.nextInStack = pickedUp;
						utility.sendToAll("[stack]" + pickedUp.id + "|" + topSelf.id);
					}
					break;
				case "drop":
					if (!utility.hasPerms(thisCubiix, "drop")) break;
					if (thisCubiix.nextInStack) {
						utility.sendToAll("[drop]" + thisCubiix.nextInStack.id);
						
						//no unstacking; dropping just pops off the entire rest of the stack.
						thisCubiix.nextInStack.stackedOn = null;
						thisCubiix.nextInStack = null;
					}
					break;
				case "requestAdmin":
					if (config.adminPassword != "" && args[0] == config.adminPassword) {
						thisCubiix.perms.push("admin");
						ws.send("[givePerms]admin");
						console.log("Cubiix '" + utility.fullName(thisCubiix) + "' is now admin.");
					}
					break;
				case "chat":
					let chatMessage = args.join("|");
					if (chatMessage[0] == "/") {
						commands.doChatCommand(thisCubiix, chatMessage.substring(1));
						break;
					}
					
					if (!utility.hasPerms(thisCubiix, "chat")) {
						ws.send("[error]You don't have the permission to send chat messages.");
						break;
					}
					
					//otherwise this is a regular chat message
					utility.sendToAll("[chat]" + thisCubiix.id + "|" + chatMessage, thisCubiix);
					break;
				}
			});
			
			ws.addEventListener("close", function(e) {
				utility.unstackCubiix(thisCubiix);
				globals.cubiixList.splice(globals.cubiixList.indexOf(thisCubiix), 1);
				utility.sendToAll("[disconnected]" + thisCubiix.id);
				
				if (config.announceJoinLeave && e.code == 1001) {
					utility.sendToAll("[note]" + utility.fullName(thisCubiix) + " has disconnected.");
				}
				console.log("Cubiix '" + utility.fullName(thisCubiix) + "' disconnected.");
			});
		} else {
			ws.close();
		}
	}, {once: true});
});