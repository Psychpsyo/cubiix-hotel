import {WebSocketServer} from "ws";

const wss = new WebSocketServer({port: 15882});
let cubiixList = [];
let lastId = 0;

function sendToAll(message) {
	cubiixList.forEach(function(cubiix) {
		cubiix.socket.send(message);
	});
}

wss.on("connection", function connection(ws) {
	let thisCubiix = {
		posX: 50,
		posY: 50,
		walking: false,
		socket: ws,
		id: lastId,
		nextInStack: null,
		stackedOn: null
	}
	lastId++;
	
	console.log("Cubiix connected. Assigning id " + thisCubiix.id + ".");
	
	//inform current cubiix about their id
	ws.send("[yourId]" + thisCubiix.id);
	
	//send all cubiix to the current one and then tell it that all of them came through
	cubiixList.forEach(function(cubiix) {
		ws.send("[newCubiix]" + cubiix.posX + "|" + cubiix.posY + "|" + cubiix.walking + "|" + cubiix.id + "|" + (cubiix.stackedOn? cubiix.stackedOn.id : ""));
	});
	ws.send("[allCubiixSent]");
	
	//send the new cubiix to all other ones.
	sendToAll("[newCubiix]" + thisCubiix.posX + "|" + thisCubiix.posY + "|" + thisCubiix.walking + "|" + thisCubiix.id + "|");
	
	//add current cubiix to the server-side list
	cubiixList.push(thisCubiix);
	
	ws.on("message", function(data) {
		data = data.toString();
		let msgType = data.substring(1, data.indexOf("]"));
		let args = data.substring(data.indexOf("]") + 1).split("|");
		
		switch(msgType) {
		case "p":
			//TODO: validate movement distance
			thisCubiix.posX = parseFloat(args[0]);
			thisCubiix.posY = parseFloat(args[1]);
			sendToAll("[p]" + thisCubiix.id + "|" + thisCubiix.posX + "|" + thisCubiix.posY);
			sendToAll("[walk]" + thisCubiix.id + "|true");
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
		}
	});
	
	ws.on("close", function() {
		//unstack the cubiix from its current stack, then remove it from the world
		unstackCubiix(thisCubiix);
		cubiixList.splice(cubiixList.indexOf(thisCubiix), 1);
		sendToAll("[disconnected]" + thisCubiix.id);
		console.log("Cubiix with id " + thisCubiix.id + " disconnected.");
	});
});

//utility functions

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