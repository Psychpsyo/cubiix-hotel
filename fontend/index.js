let walkSpeed = 96;
let playerCubiix = {
	posX: 50,
	posY: 50,
	facingRight: false,
	facingUp: false,
	walking: false,
	name: "unnamed"
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
		ctx.drawImage(sprites.cubiix, cubiix.walking? Math.floor((time / 200) % 4) * 32 : 0, 0 + cubiix.facingUp * 32 + cubiix.facingRight * 64, 32, 32, Math.floor(cubiix.posX) - 16, Math.floor(cubiix.posY) - 32, 32, 32);
	});
}

let lastTime = 0;
function update(time) {
	//calculate delta
	delta = (time - lastTime) / 1000;
	lastTime = time;
	
	//controls for walking
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
		console.log(newScale);
	}
}
window.addEventListener("resize", resizeGame);