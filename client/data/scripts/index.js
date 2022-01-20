//game related variables
var walkSpeed = 96;
var playerCubiix = {}
var cubiixList = [];
var worldMap = [];
var socket = null;
var currentGameScale = 1;
var connected = false;

//control related variables
var leftDown = false;
var rightDown = false;
var upDown = false;
var downDown = false;
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
		plankB: new Image()
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

function renderFrame(time) {
	//draw background
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
	
	//render ground
	worldMap.forEach(function(strip, i) {
		strip.forEach(function(tile, j) {
			ctx.drawImage(sprites.tiles[tile], j * 32 - Math.floor(scrollX) + (i % 2? 16 : 0), i * 8 - Math.floor(scrollY));
		})
	});
	
	//render cubiix
	cubiixList.sort(function(a, b) {
		return a.posY - b.posY;
	}).forEach(cubiix => {
		if (cubiix.stackedOn) return;
		drawCubiix(cubiix, Math.floor(cubiix.posX - scrollX), Math.floor(cubiix.posY - scrollY), time);
	});
}

function drawCubiix(cubiix, x, y, time) {
	ctx.drawImage(sprites.cubiix, (cubiix.walking && !cubiix.stackedOn)? Math.floor((time / 150) % 4) * 32 : 0, 0 + bottomCubiixInStack(cubiix).facingUp * 32 + bottomCubiixInStack(cubiix).facingRight * 64, 32, 32, x - 16, y - 32 - ((cubiix.stackedOn && bottomCubiixInStack(cubiix).walking)? (Math.floor((time / 150) % 2)? 2 : 0) : 0), 32, 32);
	if (cubiix.nextInStack) {
		drawCubiix(cubiix.nextInStack, x, y - 19, time);
	} else {
		//draw nametags once reaching the top of the stack
		let currentY = 32;
		let currentCubiix = bottomCubiixInStack(cubiix);
		while(currentCubiix) {
			ctx.fillStyle = currentCubiix.nameColor;
			ctx.fillText(currentCubiix.name, x - Math.floor(ctx.measureText(currentCubiix.name).width / 2), y - currentY);
			currentY += 10;
			currentCubiix = currentCubiix.nextInStack;
		}
	}
}

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
	if (!playerCubiix.stackedOn) {
		doWalking();
	}
	
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
	
	if (targeting) {
		playerCubiix.walking = true;
	}
	
	if (playerCubiix.walking) {
		let walkAngle = 0;
		if (targeting) {
			walkAngle = Math.atan2(targetY - playerCubiix.posY, targetX - playerCubiix.posX);
			playerCubiix.facingRight = playerCubiix.posX < targetX;
			playerCubiix.facingUp = playerCubiix.posY > targetY;
		} else {
			walkAngle = Math.atan2(yMove, xMove);
		}
		
		setCubiixPos(playerCubiix, playerCubiix.posX + Math.cos(walkAngle) * walkSpeed * delta, playerCubiix.posY + Math.sin(walkAngle) * walkSpeed * delta);
		
		socket.send("[p]" + playerCubiix.posX + "|" + playerCubiix.posY);
		
		if (targeting && Math.abs(targetX - playerCubiix.posX) < 1 && Math.abs(targetY - playerCubiix.posY) < 1) {
			targeting = false;
		}
	} else if (wasWalking) {
		socket.send("[stopWalk]");
	}
}


//controls
document.addEventListener("keydown", function(e) {
	if (!connected) return;
	
	switch(e.key) {
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
	}
});
document.addEventListener("keyup", function(e) {
	if (!connected) return;
	
	switch(e.key) {
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
		case " ":
			socket.send("[stack]");
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
});
mainCanvas.addEventListener("mousemove", function(e) {
	let canvasRect = this.getBoundingClientRect();
	mouseX = (e.clientX - canvasRect.left) / currentGameScale;
	mouseY = (e.clientY - canvasRect.top) / currentGameScale;
});

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