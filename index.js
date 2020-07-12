"use strict";
exports.__esModule = true;
var config = require("./config.json");
var logger_1 = require("./logger");
var discord_js_1 = require("discord.js");
var client_1 = require("./client");
//adding and removing submissions
require("./submission");
//list all submissions
require("./list");
//server commands
require("./server");
client_1.client.on("message", function (msg) {
    if (msg.author.bot)
        return;
    if (msg.guild === null) {
        logger_1.logger.info("Got a DM: " + msg.content);
        return;
    }
});
//blameoptifine command
client_1.client.on("message", function (msg) {
    if (msg.author.bot)
        return;
    if (!msg.content.startsWith("!blameoptifine"))
        return;
    var embed = new discord_js_1.MessageEmbed()
        .setDescription("If you have Optifine installed, make sure your forge version is set to either **28.2.0** or **28.1.54**, others are likely to conflict with it and will crash the game while launching. See [this issue](https://github.com/sp614x/optifine/issues/3561#issuecomment-602196539) for more info")
        .setColor(1146986);
    msg.channel.send(embed)["catch"](function (err) { return logger_1.logger.error("issue while sending blameoptifine response" + err.toString()); });
});
//display link the the spreadsheet
client_1.client.on("message", function (msg) {
    if (msg.author.bot)
        return;
    if (!msg.content.startsWith("!suggested"))
        return;
    var embed = new discord_js_1.MessageEmbed()
        .setDescription("Great minds think alike! Please make sure to Ctrl+F on [this spreadsheet](https://docs.google.com/spreadsheets/d/1pwX1ZlIIVeLoPXmjNl3amU4iPKpEcbl4FWkOzmYZG5w) to check whether your idea has been suggested before. Thank you!")
        .setColor(6724095);
    msg.channel.send(embed)["catch"](function (err) { return logger_1.logger.error("issue while sending suggested reply" + err.toString()); });
});
client_1.client.login(config.token)["catch"](function (err) { return logger_1.logger.error("issue during login" + err.toString()); });
