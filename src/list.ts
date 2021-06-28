import * as fs from "fs";
import {client} from "./client";

import {logger} from './logger';
import * as util from "./util";

import * as config from "./config.json";
import {
	Collection,
	CollectorFilter,
	ColorResolvable,
	Message,
	MessageEmbed,
	MessageReaction,
	PartialMessage,
	Snowflake, User
} from "discord.js";

const validCommandChannels: Array<string> = config.validCommandChannels;

//command for listing submissions
client.on("message", async (msg: Message | PartialMessage) => {
	let message: Message;

	if (!msg.content || !msg.channel)
		message = await msg.fetch();
	else
		message = msg as Message;


	if (message.author?.bot) return;

	if (!util.sentFromValidChannel(message, validCommandChannels)) return;

	let type: "suggestion" | "bug" | undefined;
	if (message.content.startsWith("!suggestions")) type = "suggestion";
	if (message.content.startsWith("!bugs")) type = "bug";
	if (!type) return;

	const files: string[] = readAllFiles(type);
	if (!files) return;

	const match: RegExpMatchArray | null = message.content.match(/dump( \d+)?( \d+)?/);

	if (match) {
		logger.info("matched dump request: " + match);
		replyDump(files, message, type, match);
		return;
	}

	const thisMessage: Message = await message.channel.send("found a total of " + files.length + " submissions for type " + type);

	if (files.length < 1) {
		await thisMessage.edit(thisMessage.content + "\nnice :)");
		return;
	} else {
		await thisMessage.edit(thisMessage.content + "\nbuilding embed, pls wait. \nif this message doesn't disappear after a few seconds, something went wrong. pls ping me");
		const embed: MessageEmbed = buildEmbedWithFiles(files, type, 0);
		//logger.debug(embed);
		await thisMessage.edit({
			content: "0",
			embeds: [ embed ]
		});
		thisMessage.react("⏪").then(() => thisMessage.react("⏩")).catch(() => logger.error("issue while adding reactions :("));
		waitForReaction(thisMessage, type);
	}

});

function waitForReaction(msg: Message, type: "suggestion" | "bug") {
	const filter: CollectorFilter<[MessageReaction, User]> = (reaction, user) => {
		return ["⏪", "⏩"].includes(reaction.emoji.name ?? "no") && !user.bot;
	};
	msg.awaitReactions(filter, {max: 1, time: 600000, errors: ["time"]})//10 minute timeout
		.then(async (collected: Collection<Snowflake, MessageReaction>) => {
			/*
			const reaction: MessageReaction | undefined = collected.first();
			if (!reaction)
				return;

			let indexModify: number = 0;
			const last: User | undefined = reaction.users.cache.last();
			if (last)
				reaction.users.remove(last.id).catch(err => logger.error("issue while removing reaction from list message" + err.toString()));
			*/

			const reaction = collected.first();
			let indexModify: number = 0;
			reaction?.users.remove(reaction.users.cache.last()?.id).catch(err => logger.error("issue while removing reaction from list message" + err.toString()));
			if (reaction?.emoji.name === "⏪") indexModify -= 1;
			if (reaction?.emoji.name === "⏩") indexModify += 1;
			const files: string[] = readAllFiles(type);
			let newIndex: number = Number(msg.content) + indexModify;
			if (newIndex < 0) newIndex = 0;
			const embed: MessageEmbed = buildEmbedWithFiles(files, type, newIndex);
			msg.edit({
				content: newIndex.toString(),
				embeds: [ embed ]
			}).catch(err => logger.error("issue while editing list message" + err.toString()));
			waitForReaction(msg, type);
		})
		.catch(async _collected => {
			logger.debug(_collected.toString());
			await msg.reactions.removeAll();
			await msg.edit("10 minute timeout passed. type the command again if needed");
			logger.info("reaction timeout, reactions cleared");
		})
}

function buildEmbedWithFiles(files: string[], type: "suggestion" | "bug", page: number): MessageEmbed {//page 0 = first page
	logger.debug("begin embed build page " + page);
	let color: ColorResolvable = (type === "suggestion") ? 6724095 : 11342935;
	const embed = new MessageEmbed()
		.setColor(color)
		.setFooter("Page " + (page + 1) + " - Entries " + (page * 10 + 1) + " to " + (page * 10 + 10) + " of " + files.length);

	let initIndex: number, maxIndex: number;
	if (files.length >= (page + 1) * 10) {
		//use 10 files
		initIndex = page * 10;
		maxIndex = initIndex + 9;
	} else if (files.length > page * 10) {
		//use 1-9 files
		initIndex = page * 10;
		maxIndex = files.length - 1;
	} else {
		//page number to high
		embed.setDescription("page empty ;_;");
		return embed;
	}
	logger.debug("initIndex " + initIndex + "    maxIndex" + maxIndex);
	//logger.debug("files  ", files);
	for (let i = initIndex; i <= maxIndex; i++) {
		//var currFile = require("./data/" + type + "s/" + files[i]);
		const currFile: any = JSON.parse(fs.readFileSync("./data/" + type + "s/" + files[i], "utf-8"));
		embed.addField("Entry " + (i + 1) + " from " + currFile.author, "[link](" + currFile.link + ") " + currFile.msg.substring(0, 850));
	}
	logger.info("embed build successful");
	return embed;
}

function replyDump(files: string[], msg: Message, type: "suggestion" | "bug", match: RegExpMatchArray): void {
	logger.debug("starting dump reply");
	let indexStart: number = 0;
	let indexEnd: number = files.length - 1;
	if (match[1]) {
		const startMatch: number = Number(match[1]);
		if (startMatch >= indexStart && startMatch <= indexEnd) indexStart = startMatch;
	}
	if (match[2]) {
		const endMatch: number = Number(match[2]);
		if (endMatch >= indexStart && endMatch <= indexEnd) indexEnd = endMatch;
	}

	let reply: string = "";
	for (let i = indexStart; i <= indexEnd; i++) {
		//const currFile = require("./data/" + type + "s/" + files[i]);
		const currFile: any = JSON.parse(fs.readFileSync("./data/" + type + "s/" + files[i], "utf-8"));
		reply = reply.concat(files[i], ": ", currFile.link, " entry ", (i + 1).toString(), " from ", currFile.author, ": ", currFile.msg.substring(0, 500), "\n");
	}

	fs.writeFileSync("./data/dump.txt", reply);
	logger.debug("written dump data to file");

	msg.channel.send({
		content: "yo have fun with this :)",
		files: [{
			attachment: "./data/dump.txt",
			name: "dump.txt"
		}]
	}).catch(err => logger.error("issue while sending reply" + err.toString()));
	logger.info("finished dump reply");
}

function readAllFiles(subDirectory: "suggestion" | "bug"): string[] {
	return fs.readdirSync("./data/" + subDirectory + "s/");
}
