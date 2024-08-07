
import process from "process";
process.umask(0o002);

import {config} from "./config.js";
import {logger} from "./logger";
import type {Message, PartialMessage} from "discord.js";
import {MessageEmbed} from "discord.js";
import {client} from "./client";
import * as api from "./api";

//adding and removing submissions
import "./submission";

//list all submissions
//import "./list";

//server commands
import "./server";

//let people self assign roles
import "./roles";

//slash commands
import * as commands from "./commands";

//moderation
import "./moderation"
import {messageZelo, sendMessageToChannel} from "./util";
import {tagCommand} from "./tag.handler";

commands.load();

client.on("messageCreate", (msg: Message | PartialMessage) => {
	if (msg.author?.bot) return;

	if (msg.guild === null) {
		if (msg.author?.id === "132983959272292353") return;

		logger.info("DM Msg - [" + msg.author?.tag + "]: " + msg.content);
		messageZelo("DM from [" + msg.author?.tag + "]: " + msg.content);
		return;
	}
});

//display link the the spreadsheet
client.on("messageCreate", (msg: Message | PartialMessage) => {
	if (msg.author?.bot) return;

	if (!(msg.content?.startsWith("!suggested"))) return;

	let embed: MessageEmbed = new MessageEmbed()
		.setDescription("Great minds think alike! Please make sure to Ctrl+F on [this spreadsheet](https://docs.google.com/spreadsheets/d/1pwX1ZlIIVeLoPXmjNl3amU4iPKpEcbl4FWkOzmYZG5w) to check whether your idea has been suggested before. Thank you!")
		.setColor(6724095);

	msg.channel?.send({
		embeds: [ embed ]
	}).catch(err => logger.error("issue while sending suggested reply" + err.toString()));

});

client.on("messageCreate", async (msg: Message) => {
	await tagCommand(msg)
})

//catch unhandled promise rejections
process.on("unhandledRejection", err => logger.error("unhandled promise rejection: ", err));

//sending arbitrary messages
process.stdin.on("data", async (data) => {
	const str: string = data.toString();
	let messageMatch = str.match(/sendMessage ([0-9]*) (.*)/);

	if (messageMatch) {
		let channel = messageMatch[1];
		let message = messageMatch[2];
		sendMessageToChannel({
			channelID: channel,
			message: message
		});
	}
});

function init() {
	//login to the bot
	client.login(config.token).catch(err => logger.error("issue during login" + err.toString()));
	api.startHttp();
}

async function shutdown() {
	client.destroy();
	await api.stopHttp();
	process.exit(0);
}

process.on("SIGINT", async () => {
	logger.info("Received SIGINT, attempting to stop server and then process");
	await shutdown();
});

process.on("SIGTERM", async () => {
	logger.info("Received SIGTERM, attempting to stop server and then process");
	await shutdown();
});

init();

