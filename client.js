"use strict";
exports.__esModule = true;
var Discord = require("discord.js");
exports.client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
var logger = require("./logger.js");
exports.client.once('ready', function () {
    logger.info('ready');
});
