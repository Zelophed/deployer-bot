import * as config from "./config.json";
import {logger} from "./logger";
import type {Message, PartialMessage} from "discord.js";
import {MessageEmbed} from "discord.js";
import {client} from "./client";

//adding and removing submissions
import "./submission";

//list all submissions
import "./list";

//server commands
import "./server";

client.on("message", (msg: Message | PartialMessage) => {
	if (msg.author.bot) return;

	if (msg.guild === null) {
		logger.info("Got a DM: " + msg.content);
		return;
	}
});

//blameoptifine command
client.on("message", (msg: Message | PartialMessage) => {
	if (msg.author.bot) return;

	if (!msg.content.startsWith("!blameoptifine")) return;

	let embed: MessageEmbed = new MessageEmbed()
		.setDescription("If you have Optifine installed, make sure your forge version is set to either **28.2.0** or **28.1.54**, others are likely to conflict with it and will crash the game while launching. See [this issue](https://github.com/sp614x/optifine/issues/3561#issuecomment-602196539) for more info")
		.setColor(1146986);

	msg.channel.send(embed).catch(err => logger.error("issue while sending blameoptifine response" + err.toString()));
})


//display link the the spreadsheet
client.on("message", (msg: Message | PartialMessage) => {
	if (msg.author.bot) return;

	if (!msg.content.startsWith("!suggested")) return;

	let embed: MessageEmbed = new MessageEmbed()
		.setDescription("Great minds think alike! Please make sure to Ctrl+F on [this spreadsheet](https://docs.google.com/spreadsheets/d/1pwX1ZlIIVeLoPXmjNl3amU4iPKpEcbl4FWkOzmYZG5w) to check whether your idea has been suggested before. Thank you!")
		.setColor(6724095);

	msg.channel.send(embed).catch(err => logger.error("issue while sending suggested reply" + err.toString()));

});

//catch unhandled promise rejections
process.on("unhandledRejection", err => logger.error("unhandled promise rejection: " + err.toString()));

//login to the bot
client.login(config.token).catch(err => logger.error("issue during login" + err.toString()));
