//gets a cubiix by its id.
function cubiixById(id) {
	return cubiixList.find(c => {return c.id == id});
}

//gets the very bottom cubiix in a stack, given any cubiix from that stack.
function bottomCubiixInStack(cubiix) {
	if (cubiix.stackedOn) {
		return bottomCubiixInStack(cubiix.stackedOn);
	}
	return cubiix;
}

//takes a cubiix and all other cubiix above it out of a stack.
function unstackCubiix(cubiix) {
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

function setCubiixPos(cubiix, x, y) {
	cubiix.posX = x;
	cubiix.posY = y;
	if (cubiix.nextInStack) {
		setCubiixPos(cubiix.nextInStack, x, y);
	}
}