const fs = require("fs");

//load config file
module.exports = JSON.parse(fs.readFileSync("config.json"));

if (module.exports.generateAdminPassword) {
	module.exports.adminPassword = String(Math.floor(Math.random() * 10000000)).padStart(8, "0");
	console.log("Generated admin password " + module.exports.adminPassword + " for this session.")
}
//TODO: validate config file