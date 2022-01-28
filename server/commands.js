const utility = require("./utility.js");
const config = require("./config.js");

//execute a chat command from a user
module.exports.doChatCommand = function(cubiix, command) {
	if (!utility.hasPerms(cubiix, "commands")) {
		cubiix.socket.send("[error]You don't have the permission to run chat commands.");
		return;
	}
	let commandParts = command.split(" ");
	
	switch (commandParts[0]) {
		case "respawn": {
			utility.respawn(cubiix);
			break;
		}
		case "givePerms": {
			if (!utility.hasPerms(cubiix, "givePerms")) {
				cubiix.socket.send("[error]You don't have the permission to give others permissions.");
				break;
			}
			//check if there's enough parameters in the command
			if (commandParts.length < 3) {
				cubiix.socket.send("[error]Not enough parameters.");
				break;
			}
			
			let permission = commandParts[1];
			//ensure that they have admin perms themselves if they want to give someone admin.
			if (permission == "admin" && !utility.hasPerms(cubiix, "admin")) {
				cubiix.socket.send("[error]You must be an admin to give someone admin rights.");
				break;
			}
			let target = utility.cubiixFromId(commandParts[2]);
			if (!target) {
				cubiix.socket.send("[error]'" + commandParts[2] + "' did not match any Cubiix in the session.");
				break;
			}
			
			//check if target already has the permission in question
			if (target.perms.includes(permission)) {
				cubiix.socket.send("[error]" + utility.fullName(target) + " already has " + permission + " permissions.");
				break;
			}
			
			//all checks done, give them the permission
			target.perms.push(permission);
			target.socket.send("[givePerms]" + permission);
			target.socket.send("[success]You have been granted " + permission + " permissions.");
			cubiix.socket.send("[success]Given " + permission + " permissions to " + utility.fullName(target) + ".");
			
			if (permission == "admin") { //if someone got admin, announce it in the logs and, if set, the chat.
				console.log(utility.fullName(target) + " was given admin permissions by " + utility.fullName(cubiix) + ".");
				if (config.announceAdminPerms) {
					utility.sendToAll("[note]" + utility.fullName(target) + " has been granted admin permissions.", target);
				}
			}
			break;
		}
		case "takePerms": {
			if (!utility.hasPerms(cubiix, "takePerms")) {
				cubiix.socket.send("[error]You don't have the permission to take permissions from others.");
				break;
			}
			//check if there's enough parameters in the command
			if (commandParts.length < 3) {
				cubiix.socket.send("[error]Not enough parameters.");
				break;
			}
			
			let permission = commandParts[1];
			//ensure that they have admin perms themselves if they want to take admin from someone.
			if (permission == "admin" && !utility.hasPerms(cubiix, "admin")) {
				cubiix.socket.send("[error]You must be an admin to give someone admin rights.");
				break;
			}
			
			let target = utility.cubiixFromId(commandParts[2]);
			if (!target) {
				cubiix.socket.send("[error]'" + commandParts[2] + "' did not match any Cubiix in the session.");
				break;
			}
			
			//check if target even has the permission in question
			if (!target.perms.includes(permission)) {
				cubiix.socket.send("[error]" + utility.fullName(target) + " does not have " + permission + " permissions.");
				break;
			}
			
			//all checks done, take their permission away
			while (target.perms.includes(permission)) {
				target.perms.splice(target.perms.indexOf(permission), 1);
			}
			target.socket.send("[takePerms]" + permission);
			target.socket.send("[error]Your " + permission + " permissions have been revoked.");
			cubiix.socket.send("[success]Taken " + permission + " permissions from " + utility.fullName(target) + ".");
			
			if (permission == "admin") { //if someone got admin taken away, announce it in the logs and, if set, the chat.
				console.log(utility.fullName(cubiix) + " took admin permissions away from " + utility.fullName(target) + ".");
				if (config.announceAdminPerms) {
					utility.sendToAll("[note]" + utility.fullName(target) + " has had their admin permissions revoked.", target);
				}
			}
			break;
		}
		case "kick": {
			if (!utility.hasPerms(cubiix, "kick")) {
				cubiix.socket.send("[error]You don't have the permission to kick people.");
				break;
			}
			
			if (commandParts.length < 2) {
				cubiix.socket.send("[error]Not enough parameters.");
				break;
			}
			
			let target = utility.cubiixFromId(commandParts[1]);
			if (!target) {
				cubiix.socket.send("[error]'" + commandParts[1] + "' did not match any Cubiix in the session.");
				break;
			}
			
			//terminate their connection
			target.socket.send("[kick]You have been kicked from the server." + (commandParts.length > 2? "\nReason: " + commandParts.slice(2).join(" ") : "\nNo reason was provided as to why."));
			target.socket.close();
			utility.sendToAll("[note]" + utility.fullName(target) + " has been kicked from the server.", target);
			break;
		}
		case "ban": {
			if (!utility.hasPerms(cubiix, "ban")) {
				cubiix.socket.send("[error]You don't have the permission to ban people.");
				break;
			}
			
			if (commandParts.length < 2) {
				cubiix.socket.send("[error]Not enough parameters.");
				break;
			}
			
			let target = utility.cubiixFromId(commandParts[1]);
			if (!target) {
				cubiix.socket.send("[error]'" + commandParts[1] + "' did not match any Cubiix in the session.");
				break;
			}
			
			//ban their IP and disconnect them.
			config.bannedIPs.push(target.socket._socket.remoteAddress);
			target.socket.send("[kick]You have been banned from this server." + (commandParts.length > 2? "\nReason: " + commandParts.slice(2).join(" ") : "\nNo reason was provided as to why."));
			target.socket.close();
			utility.sendToAll("[error]" + utility.fullName(target) + " has been banned from the server.", target);
			break;
		}
		case "tp": {
			if (!utility.hasPerms(cubiix, "teleport")) {
				cubiix.socket.send("[error]You don't have the permission to teleport.");
				break;
			}
			
			if (commandParts.length < 2) {
				cubiix.socket.send("[error]Not enough parameters.");
				break;
			}
			
			let targetX = NaN;
			let targetY = NaN;
			if (commandParts[1][0] == "#") { //teleporting to a cubiix
				targetCubiix = utility.cubiixFromId(commandParts[1]);
				if (!targetCubiix) {
					cubiix.socket.send("[error]'" + commandParts[1] + "' did not match any Cubiix in the session.");
					break;
				}
				
				targetX = targetCubiix.posX;
				targetY = targetCubiix.posY;
				
				//stack on to the other cubiix if you have sufficient perms
				if (utility.hasPerms(cubiix, "stack") && utility.hasPerms(cubiix, "unstack")) {
					let other = utility.topCubiixInStack(targetCubiix);
					cubiix.stackedOn = other;
					other.nextInStack = cubiix;
					utility.sendToAll("[stack]" + cubiix.id + "|" + other.id);
				}
				
				cubiix.socket.send("[note]Teleported to " + utility.fullName(targetCubiix) + ".");
			} else { //teleporting to location or coordinates
				targetX = parseFloat(commandParts[1]); //parse X here already to check if it may be a location
				//location
				if (isNaN(targetX)) {
					targetLocation = config.tpLocations.find(tpLocation => {
						return tpLocation.name == commandParts[1];
					});
					if (!targetLocation) {
						cubiix.socket.send("[error]" + commandParts[1] + " is not a location.");
						break;
					}
					
					targetX = targetLocation.x;
					targetY = targetLocation.y;
					cubiix.socket.send("[note]Teleported to " + targetLocation.name + ".");
				} else {
					//coordinates
					if (commandParts.length < 3) {
						cubiix.socket.send("[error]Not enough parameters.");
						break;
					}
					
					targetY = parseFloat(commandParts[2]); //only parse Y since X already got parsed.
					
					if (isNaN(targetX) || isNaN(targetY)) {
						cubiix.socket.send("[error]You must specify X and Y coordinates as numbers.");
						break;
					}
					cubiix.socket.send("[note]Teleported to " + targetX + ", " + targetY + ".");
				}
				
				
			}
			
			cubiix.posX = targetX;
			cubiix.posY = targetY;
			utility.sendToAll("[p]" + cubiix.id + "|" + targetX + "|" + targetY);
			break;
		}
		default: {
			cubiix.socket.send("[error]Command does not exist.");
		}
	}
}