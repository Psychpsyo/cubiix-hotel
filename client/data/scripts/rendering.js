function renderFrame(time) {
	//draw background
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
	
	//render ground
	worldMap.forEach(function(strip, i) {
		strip.forEach(function(tile, j) {
			if (tile == "") return; //ignore empty tiles
			if (tile[0] == "#") { //draw colored tile if the tile is a hex code.
				ctx.globalCompositeOperation = "lighter";
				ctx.globalAlpha = parseInt(tile.substring(1, 3), 16) / 255;
				ctx.drawImage(sprites.tiles["red"], j * 32 - Math.floor(scrollX) + (i % 2? 16 : 0), i * 8 - Math.floor(scrollY));
				ctx.globalAlpha = parseInt(tile.substring(3, 5), 16) / 255;
				ctx.drawImage(sprites.tiles["green"], j * 32 - Math.floor(scrollX) + (i % 2? 16 : 0), i * 8 - Math.floor(scrollY));
				ctx.globalAlpha = parseInt(tile.substring(5, 8), 16) / 255;
				ctx.drawImage(sprites.tiles["blue"], j * 32 - Math.floor(scrollX) + (i % 2? 16 : 0), i * 8 - Math.floor(scrollY));
				ctx.globalAlpha = 1;
				ctx.globalCompositeOperation = "source-over";
			} else {
				ctx.drawImage(sprites.tiles[tile]??sprites.tiles["missing"], j * 32 - Math.floor(scrollX) + (i % 2? 16 : 0), i * 8 - Math.floor(scrollY));
			}
		})
	});
	
	//render cubiix
	cubiixList.sort(function(a, b) {
		return a.posY - b.posY;
	}).forEach(cubiix => {
		if (cubiix.stackedOn) return;
		drawCubiix(cubiix, Math.floor(cubiix.posX - scrollX), Math.floor(cubiix.posY - scrollY), time);
	});
	
	//render player list
	if (ctrlDown) {
		cubiixList.sort(function(a, b) {
			return a.name > b.name;
		}).forEach((cubiix, i) => {
			drawName(0, 20 + i * 17, cubiix, false, true);
		});
	}
}

function drawCubiix(cubiix, x, y, time) {
	ctx.drawImage(sprites.cubiix, (cubiix.walking && !cubiix.stackedOn)? Math.floor((time / 15000 * walkSpeed) % 4) * 32 : 0, 0 + bottomCubiixInStack(cubiix).facingUp * 32 + bottomCubiixInStack(cubiix).facingRight * 64, 32, 32, x - 16, y - 32 - ((cubiix.stackedOn && bottomCubiixInStack(cubiix).walking)? (Math.floor((time / 15000 * walkSpeed) % 2)? 2 : 0) : 0), 32, 32);
	if (cubiix.nextInStack) {
		drawCubiix(cubiix.nextInStack, x, y - 19, time);
	} else {
		//draw nametags once reaching the top of the stack
		let currentY = 32;
		let currentCubiix = bottomCubiixInStack(cubiix);
		while(currentCubiix) {
			drawName(x, y - currentY, currentCubiix, true);
			currentY += 17;
			currentCubiix = currentCubiix.nextInStack;
		}
	}
}

//draw a cubiix's name at the specified X and Y position
function drawName(x, y, cubiix, centered, withId) {
	let toDraw = cubiix.name + (withId? "#" + cubiix.id : "");
	let nameSize = ctx.measureText(toDraw);
	if (centered) {
		x -= Math.floor(nameSize.width / 2) + 2;
	}
	ctx.fillStyle = "black";
	ctx.globalAlpha = .5;
	ctx.fillRect(x, y - 13, nameSize.width + 3, 17);
	ctx.globalAlpha = 1;
	ctx.fillStyle = cubiix.nameColor;
	ctx.fillText(toDraw, x + 2, y);
}