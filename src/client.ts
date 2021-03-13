import * as Discord from "discord.js";

import {logger} from "./logger.js";

export const client: Discord.Client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
client.once('ready', () => {
	logger.info('ready');
});
