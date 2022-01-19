//handle incoming messages from the server
function receiveMessage(message) {
	let msgType = message.data.substring(1, message.data.indexOf("]"));
	let args = message.data.substring(message.data.indexOf("]") + 1).split("|");
	
	switch(msgType) {
		case "p":
			let cubiix = cubiixById(args[0]);
			let oldX = cubiix.posX;
			let oldY = cubiix.posY;
			cubiix.posX = parseFloat(args[1]);
			cubiix.posY = parseFloat(args[2]);
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
		case "newCubiix":
			cubiixList.push({
				posX: parseFloat(args[0]),
				posY: parseFloat(args[1]),
				facingRight: false,
				facingUp: false,
				walking: args[2] == "true",
				name: "unnamed",
				id: args[3],
				nextInStack: null,
				stackedOn: args[4] == ""? null : args[4]
			})
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
		case "yourId":
			playerCubiix.id = args[0];
			break;
	}
}

socket = new WebSocket("ws://93.213.160.17:15882");

socket.addEventListener("open", function (event) {
	//socket.send("[hi]" + name); TODO: Send name and stuff
});

socket.addEventListener("message", receiveMessage);