let walkSpeed = 96;
let playerCubiix = {
	posX: 50,
	posY: 50,
	facingRight: false,
	facingUp: false,
	walking: false,
	name: "unnamed",
	id: "",
	nextInStack: null,
	stackedOn: null
}
let cubiixList = [playerCubiix];

//load general images
let spritesLoaded = 0;
var sprites = {
	cubiix: new Image()
}

for (const sprite in sprites) {
	sprites[sprite].addEventListener("load", initialSpriteLoaded, {once: true});
}

sprites.cubiix.src = "cubiix.png";

//get reference to the canvas
var ctx = mainCanvas.getContext("2d");

function initialSpriteLoaded() {
	spritesLoaded++;
	if (spritesLoaded < Object.keys(sprites).length) return;
	
	//first update to start the game
	resizeGame();
	requestAnimationFrame(update);
}

function renderFrame(time) {
	//draw background
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
var leftDown = false;
var rightDown = false;
var upDown = false;
var downDown = false;
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
let currentGameScale = 1;
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