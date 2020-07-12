import * as Discord from "discord.js";

export const client: Discord.Client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });

const logger = require("./logger.js");

client.once('ready', () => {
	logger.info('ready');
});
