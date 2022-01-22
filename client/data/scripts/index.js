//game related variables
var walkSpeed = 100;
var playerCubiix = {}
var cubiixList = [];
var worldMap = [];
var mapWidth = 0;
var mapHeight = 0;
var socket = null;
var currentGameScale = 1;
var connected = false;
var yourPerms = [];
var floorEditMode = false;
var floorEditPen = "grid";

//control related variables
var leftDown = false;
var rightDown = false;
var upDown = false;
var downDown = false;
var ctrlDown = false;
var mouseHolding = false;
var targeting = false;
var targetX = 0; //target x position for mouse movement
var targetY = 0; //target y position for mouse movement
var mouseX = 0; //x position of the mouse, in canvas pixels. Does not include scroll offset!
var mouseY = 0; //y position of the mouse, in canvas pixels. Does not include scroll offset!
var scrollX = 0; //how far right the screen is scrolled
var scrollY = 0; //how far left the screen is scrolled

//load general images
var sprites = {
	cubiix: new Image(),
	tiles: {
		grid: new Image(),
		plankA: new Image(),
		plankB: new Image(),
		red: new Image(),
		green: new Image(),
		blue: new Image(),
		missing: new Image()
	}
}
sprites.cubiix.src = "data/cubiix.png";
for (key in sprites.tiles) {
	sprites.tiles[key].src = "data/tiles/" + key + ".png";
}

//get reference to the canvas
var ctx = mainCanvas.getContext("2d");
ctx.font = "18px Cubes";

resizeGame();
//do the first game tick
requestAnimationFrame(update);

var lastTime = 0;
var delta = 0;
function update(time) {
	//skip to the next frame instantly when not connected to a server
	if (!connected) {
		requestAnimationFrame(update);
		return;
	}
	
	//calculate delta
	delta = (time - lastTime) / 1000;
	lastTime = time;
	
	//controls for walking
	doWalking();
	
	//scroll along the X and why when too close to the screen border
	if (playerCubiix.posX > scrollX + 300) {
		scrollX = playerCubiix.posX - 300;
	} else if (playerCubiix.posX < scrollX + 100) {
		scrollX = playerCubiix.posX - 100;
	}
	
	if (playerCubiix.posY > scrollY + 220) {
		scrollY = playerCubiix.posY - 220;
	} else if (playerCubiix.posY < scrollY + 100) {
		scrollY = playerCubiix.posY - 100;
	}
	
	//render the frame
	renderFrame(time);
	
	//next frame
	requestAnimationFrame(update);
}

function doWalking() {
	//check if you can/are allowed to walk
	if (playerCubiix.stackedOn || !checkPerms("move")) return;
	
	if (mouseHolding) {
		targetX = mouseX + scrollX;
		targetY = mouseY + scrollY;
	}
	
	let wasWalking = playerCubiix.walking;
	playerCubiix.walking = false;
	let xMove = 0;
	let yMove = 0;
	if (upDown && !downDown) {
		yMove = -1;
		playerCubiix.facingUp = true;
		playerCubiix.walking = true;
	}
	if (downDown && !upDown) {
		yMove = 1;
		playerCubiix.facingUp = false;
		playerCubiix.walking = true;
	}
	if (leftDown && !rightDown) {
		xMove = -1;
		playerCubiix.facingRight = false;
		playerCubiix.walking = true;
	}
	if (rightDown && !leftDown) {
		xMove = 1;
		playerCubiix.facingRight = true;
		playerCubiix.walking = true;
	}
	
	if (targeting && cubiixPointDist(playerCubiix, targetX, targetY) > 1) {
		playerCubiix.walking = true;
	}
	
	if (playerCubiix.walking) {
		let walkAngle = 0;
		if (targeting) {
			walkAngle = Math.atan2(targetY - playerCubiix.posY, targetX - playerCubiix.posX);
			playerCubiix.facingRight = playerCubiix.posX < targetX;
			playerCubiix.facingUp = playerCubiix.posY > targetY;
			
			if (cubiixPointDist(playerCubiix, targetX, targetY) < 2 && !mouseHolding) {
				targeting = false;
			}
		} else {
			walkAngle = Math.atan2(yMove, xMove);
		}
		
		setCubiixPos(playerCubiix, playerCubiix.posX + Math.cos(walkAngle) * walkSpeed * delta, playerCubiix.posY + Math.sin(walkAngle) * walkSpeed * delta);
		
		socket.send("[p]" + playerCubiix.posX + "|" + playerCubiix.posY);
		
		if (floorEditMode && checkPerms("floorEdit")) {
			tile = tileCoords(playerCubiix.posX, playerCubiix.posY);
			if (tile[0] >= 0 && tile[1] >= 0 && tile[0] < mapWidth && tile[1] < mapHeight) {
				if (worldMap[tile[1]][tile[0]] != floorEditPen) {
					socket.send("[floor]" + tile[0] + "|" + tile[1] + "|" + floorEditPen);
					worldMap[tile[1]][tile[0]] = floorEditPen;
				}
			}
		}
	} else if (wasWalking) {
		socket.send("[stopWalk]");
	}
}


//controls
document.addEventListener("keydown", function(e) {
	if (!connected || document.activeElement != document.body) return;
	
	switch(e.code) {
		case "ArrowLeft":
			leftDown = true;
			targeting = false
			break;
		case "ArrowRight":
			rightDown = true;
			targeting = false
			break;
		case "ArrowUp":
			upDown = true;
			targeting = false
			break;
		case "ArrowDown":
			downDown = true;
			targeting = false
			break;
		case "ControlLeft":
			ctrlDown = true;
			break;
	}
});
document.addEventListener("keyup", function(e) {
	if (!connected || document.activeElement != document.body) return;
	
	switch(e.code) {
		case "ArrowLeft":
			leftDown = false;
			break;
		case "ArrowRight":
			rightDown = false;
			break;
		case "ArrowUp":
			upDown = false;
			break;
		case "ArrowDown":
			downDown = false;
			break;
		case "Space":
			if ((playerCubiix.stackedOn && checkPerms("unstack")) || (!playerCubiix.stackedOn && checkPerms("stack"))) {
				socket.send(playerCubiix.stackedOn? "[unstack]" : "[stack]");
			}
			break;
		case "KeyP":
			if ((!playerCubiix.nextInStack && checkPerms("pickUp")) || (playerCubiix.nextInStack && checkPerms("drop"))) {
				socket.send(playerCubiix.nextInStack? "[drop]" : "[pickUp]");
			}
			break;
		case "ControlLeft":
			ctrlDown = false;
			break;
	}
});
//mouse controls
mainCanvas.addEventListener("mousedown", function(e) {
	mouseHolding = true;
	
	targeting = true;
});
mainCanvas.addEventListener("mouseup", function(e) {
	mouseHolding = false;
	if (cubiixPointDist(playerCubiix, targetX, targetY) < 2 || playerCubiix.stackedOn) {
		targeting = false;
	}
});
mainCanvas.addEventListener("mousemove", function(e) {
	let canvasRect = this.getBoundingClientRect();
	mouseX = (e.clientX - canvasRect.left) / currentGameScale;
	mouseY = (e.clientY - canvasRect.top) / currentGameScale;
});

//make chat work
chatInput.addEventListener("keypress", function(e) {
	if (e.code == "Enter"){
		socket.send("[chat]" + this.value);
		
		if (this.value == "/respawn") {
			targeting = false;
		}
		
		chatHistory.appendChild(document.createTextNode(playerCubiix.name + ": " + this.value));
		chatHistory.appendChild(document.createElement("br"));
		this.value = "";
	}
})

//resizing the canvas
function resizeGame() {
	let xMax = Math.floor(window.innerWidth / mainCanvas.width);
	let yMax = Math.floor(window.innerHeight / mainCanvas.height);
	let newScale = Math.min(xMax, yMax);
	if (newScale != currentGameScale) {
		currentGameScale = newScale;
		mainCanvas.style.width = (mainCanvas.width * newScale) + "px";
		mainCanvas.style.height = (mainCanvas.height * newScale) + "px";
	}
}
window.addEventListener("resize", resizeGame);