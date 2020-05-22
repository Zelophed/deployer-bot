const Discord = require("discord.js");
const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });

const logger = require("./logger.js");

client.once('ready', () => {
    logger.info('ready');
});

module.exports = client;
