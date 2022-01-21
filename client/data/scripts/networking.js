//handle incoming messages from the server
function receiveMessage(message) {
	let msgType = message.data.substring(1, message.data.indexOf("]"));
	let args = message.data.substring(message.data.indexOf("]") + 1).split("|");
	
	switch(msgType) {
		case "p":
			let cubiix = cubiixById(args[0]);
			let oldX = cubiix.posX;
			let oldY = cubiix.posY;
			setCubiixPos(cubiix, parseFloat(args[1]), parseFloat(args[2]));
			//correct rotation of the cubiix
			if (cubiix.posX > oldX) {
				cubiix.facingRight = true;
			} else if (cubiix.posX < oldX) {
				cubiix.facingRight = false;
			}
			if (cubiix.posY > oldY) {
				cubiix.facingUp = false;
			} else if (cubiix.posY < oldY) {
				cubiix.facingUp = true;
			}
			
			//if server puts the player outside the scroll-to area, center camera on their cubiix.
			if (cubiix == playerCubiix && Math.abs(playerCubiix.posX - (scrollX + 200)) > 100 || Math.abs(playerCubiix.posY - (scrollY + 160)) > 60) {
				scrollX = playerCubiix.posX - 200;
				scrollY = playerCubiix.posY - 160;
			}
			break;
		case "walk":
			cubiixById(args[0]).walking = args[1] == "true";
			break;
		case "stack":
			cubiixById(args[0]).stackedOn = cubiixById(args[1]);
			cubiixById(args[1]).nextInStack = cubiixById(args[0]);
			break;
		case "unstack":
			unstackCubiix(cubiixById(args[0]));
			break;
		case "drop":
			let droppedCubiix = cubiixById(args[0]);
			droppedCubiix.posX = bottomCubiixInStack(droppedCubiix).posX;
			droppedCubiix.posY = bottomCubiixInStack(droppedCubiix).posY;
			
			droppedCubiix.stackedOn.nextInStack = null;
			droppedCubiix.stackedOn = null;
			break;
		case "newCubiix":
			cubiixList.push({
				posX: parseFloat(args[0]),
				posY: parseFloat(args[1]),
				facingRight: false,
				facingUp: false,
				walking: args[2] == "true",
				id: args[3],
				nextInStack: null,
				stackedOn: args[4] == ""? null : args[4],
				name: args[5],
				nameColor: args[6]
			});
			break;
		case "allCubiixSent":
			//resolve all the stacks from cubiix ids to actual references to cubiix.
			cubiixList.forEach(cubiix => {
				if (cubiix.stackedOn) {
					cubiix.stackedOn = cubiixById(cubiix.stackedOn);
					cubiix.stackedOn.nextInStack = cubiix;
				}
			});
			break;
		case "disconnected":
			cubiixList.splice(cubiixList.indexOf(cubiixById(args[0])), 1);
			break;
		case "floor":
			worldMap[parseInt(args[1])][parseInt(args[0])] = args[2];
			break;
		case "walkSpeed":
			walkSpeed = args[0];
			break;
		case "yourId":
			playerCubiix = cubiixById(args[0]);
			
			//center camera on the cubiix.
			scrollX = playerCubiix.posX - 200;
			scrollY = playerCubiix.posY - 160;
			break;
		case "givePerms":
			yourPerms = yourPerms.concat(args);
			break;
		case "takePerms":
			for (permission of args) {
				while (permission in yourPerms) {
					yourPerms.splice(yourPerms.indexOf(permission), 1);
				}
			}
			break;
		case "map":
			//initialize map
			worldMap = [];
			mapWidth = parseInt(args[0]);
			mapHeight = parseInt(args[1]);
			for (let i = 0; i < mapHeight; i++) {
				worldMap.push(args.slice(2 + i * mapWidth, 2 + i * mapWidth + mapHeight));
			}
			break;
	}
}

function connectToServer(address) {
	if (socket) {
		socket.close();
		//reset data
		map = [];
		yourPerms = [];
		cubiixList = [];
	}
	
	let url = new URL("ws://" + address);
	if (url.port == "") {
		url.port = 15882;
	}
	
	socket = new WebSocket(url.href);
	socket.addEventListener("message", receiveMessage);
	socket.addEventListener("open", function (event) {
		connected = true;
		socket.send("[init]" + usernameInput.value + "|" + nameTagColorInput.value);
		
		if (adminPasswordInput.value != "") {
			socket.send("[requestAdmin]" + adminPasswordInput.value);
		}
	});
}

connectButton.addEventListener("click", function() {
	connectToServer(addressInput.value);
	initialScreen.style.display = "none";
	mainCanvas.style.display = "block";
})
