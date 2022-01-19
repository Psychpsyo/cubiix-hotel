var walkSpeed = 96;
var playerCubiix = {}
var cubiixList = [];
var name = "";
var socket = null;
var currentGameScale = 1;

var leftDown = false;
var rightDown = false;
var upDown = false;
var downDown = false;

//load general images
var sprites = {
	cubiix: new Image()
}
sprites.cubiix.src = "data/cubiix.png";

//get reference to the canvas
var ctx = mainCanvas.getContext("2d");

function startGame() {
	requestAnimationFrame(update);
}

resizeGame();
startGame();

function renderFrame(time) {
	//draw background
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
	
	//render cubiix
	cubiixList.sort(function(a, b) {
		return a.posY - b.posY;
	}).forEach(cubiix => {
		if (cubiix.stackedOn) return;
		drawCubiix(cubiix, Math.floor(cubiix.posX), Math.floor(cubiix.posY), time);
	});
}

function drawCubiix(cubiix, x, y, time) {
	ctx.drawImage(sprites.cubiix, (cubiix.walking && !cubiix.stackedOn)? Math.floor((time / 200) % 4) * 32 : 0, 0 + bottomCubiixInStack(cubiix).facingUp * 32 + bottomCubiixInStack(cubiix).facingRight * 64, 32, 32, x - 16, y - 32 - ((cubiix.stackedOn && bottomCubiixInStack(cubiix).walking)? (Math.floor((time / 200) % 2)? 2 : 0) : 0), 32, 32);
	if (cubiix.nextInStack) {
		drawCubiix(cubiix.nextInStack, x, y - 19, time);
	} else {
		//draw nametags once reaching the top of the stack
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		
		let currentY = 32;
		let currentCubiix = bottomCubiixInStack(cubiix);
		while(currentCubiix) {
			ctx.fillText(currentCubiix.name, x, y - currentY);
			currentY += 10;
			currentCubiix = currentCubiix.nextInStack;
		}
	}
}

let lastTime = 0;
function update(time) {
	//calculate delta
	delta = (time - lastTime) / 1000;
	lastTime = time;
	
	//controls for walking
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
	if (playerCubiix.walking) {
		walkAngle = Math.atan2(yMove, xMove);
		playerCubiix.posX += Math.cos(walkAngle) * walkSpeed * delta;
		playerCubiix.posY += Math.sin(walkAngle) * walkSpeed * delta;
		
		socket.send("[p]" + playerCubiix.posX + "|" + playerCubiix.posY);
	} else if (wasWalking) {
		socket.send("[stopWalk]");
	}
	
	//render the frame
	renderFrame(time);
	
	//next frame
	requestAnimationFrame(update);
}



//controls
document.addEventListener("keydown", function(e) {
	switch(e.key) {
		case "ArrowLeft":
			leftDown = true;
			break;
		case "ArrowRight":
			rightDown = true;
			break;
		case "ArrowUp":
			upDown = true;
			break;
		case "ArrowDown":
			downDown = true;
			break;
	}
});
document.addEventListener("keyup", function(e) {
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