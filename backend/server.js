import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({port: 15882});
let cubiixList = [];

wss.on("connection", function connection(ws) {
	cubiixList.forEach(function(cubiix) {
		ws.send("[newCubiix]" + cubiix.posX + "|" + cubiix.posY + "|" cubiix.walking);
	});
	cubiixList.push({
		posX: 50,
		posY: 50,
		walking: false
	});
	
	ws.on("message", function(data) {
		console.log("received message: " + data);
	});
});