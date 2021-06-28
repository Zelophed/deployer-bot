import * as Discord from "discord.js";

import {logger} from "./logger.js";

const myIntents = new Discord.Intents();
myIntents.add("GUILDS", "GUILD_MEMBERS", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "DIRECT_MESSAGES");

export const client: Discord.Client = new Discord.Client({
	partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
	intents: myIntents
});
client.setMaxListeners(25);
client.once('ready', () => {
	logger.info('ready');
});
