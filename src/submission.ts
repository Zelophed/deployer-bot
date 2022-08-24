
import {config} from "./config.js";

import * as fs from "fs";

import {client} from "./client.js";
import {logger} from "./logger.js";
import * as util from "./util.js";
import type {Message, PartialMessage, PartialUser, Snowflake} from "discord.js";
import {GuildMember, MessageReaction, TextChannel, User} from "discord.js";

const validSubmissionChannels: string[] = config.validSubmissionChannels;
const rolesThatCanRemoveSubmissions: string[] = config.rolesThatCanRemoveSubmissions;
const roleSuggestionId: string = config.roleSuggestionId;
const roleBugId: string = config.roleBugId;

//recognize submission and store to files
client.on('message', async (message: Message | PartialMessage) => {
	if (message.author?.bot) return;

	if (message.guild === null) return;

	let msg: Message;

	if (message.partial)
		msg = await message.fetch();
	else
		msg = message as Message;

	await validateSubmission(msg);
});

//delete files when message gests deleted
client.on("messageDelete", async (msg) => {
	if (!util.sentFromValidChannel(msg, validSubmissionChannels)) return;
	logger.info("message deleted. " + msg.id + ".json    checking for files")
	scanAndRemoveFile(msg);
})

//remove all reaction and delete file if reacted to the X emoji
client.on("messageReactionAdd", async (reaction: MessageReaction, user: User | PartialUser) => {
	if (reaction.partial) {
		try {
			await reaction.fetch();
		} catch (err) {
			logger.error("error while fetching reaction partial: ", err);
			return;
		}
	}

	if (user.bot) return;

	logger.debug("begin reaction added handler");

	if (!util.sentFromValidChannel(reaction.message, validSubmissionChannels)) return;

	//logger.debug("valid channel");
	//logger.debug("reaction emoji ", reaction.emoji.name);

	if (reaction.emoji.name !== "❌") return;

	logger.debug("correct emoji");

	let member: GuildMember | null | undefined = reaction.message.guild?.members.cache.get(user.id);
	if (!member) return;

	logger.debug("member ", member);

	reaction.message.reactions.cache.forEach(value => logger.debug(value.emoji.name));

	if (!reaction.message.reactions.cache.some((react: MessageReaction) => react.emoji.name === "🤖")) return;

	//check if member has special role;
	let allowedToRemove: boolean = reaction.message.author?.id === user.id;
	allowedToRemove = allowedToRemove || member.roles.cache.some(role => rolesThatCanRemoveSubmissions.includes(role.id));
	if (!allowedToRemove) return;

	logger.debug("right role, clearing reactions and removing file");
	//all conditions clear?
	reaction.message.reactions.removeAll().catch(err => logger.error("failed to clear all reactions: ", err));
	scanAndRemoveFile(reaction.message);

	logger.debug("reaction handler done");
});

async function validateSubmission(message: Message) {
	logger.debug("Msg - (#" + (<TextChannel>message.channel).name + ") [" + message.author.tag + "]: " + message.content);

	if (!util.sentFromValidChannel(message, validSubmissionChannels))
		return;

	const roles = message.mentions.roles;
	if (!roles) return;

	let suggestion: boolean = false;
	let bug: boolean = false;
	if (roles.get(<Snowflake>roleSuggestionId)) suggestion = true;
	if (roles.get(<Snowflake>roleBugId)) bug = true;

	if (!(suggestion || bug)) return;

	if (message.type === "REPLY") {
		if (await handleReply(message, suggestion, bug).catch(err => logger.error("issue while handling reply submission", err)))
			return;
	}

	/*const match: RegExpMatchArray | null = message.content.match(/^<@&\d+> above (\d+)$/);
	//logger.debug("match: ", match);
	if (match) {
		const target: number = Number(match[1]);
		//logger.debug("target: ", target);

		let targetMessage: Message | undefined;

		await message.channel.messages.fetch({limit: target, before: message.id}).then(fetched => {
			//fetched.array().forEach((m, i, _a) => logger.debug("forEach: @" + i + ": " + m.content));
			targetMessage = fetched.last();
			logger.debug("last: " + targetMessage?.content);
		}).catch(err => logger.debug("issue while fetching messages .. " + err.toString()));

		if (!targetMessage) {
			await message.reply("no target found ;_;").then(async msg => {
				await new Promise(r => setTimeout(r, 5000));
				msg.delete().catch(err => logger.debug("issue while deleting reply message " + err.toString()));
				message.delete().catch((err) => logger.error("issue while deleting above-submission message ", err.toString()));
			}).catch(err => logger.debug("issue while replying " + err.toString()));
			return;
		}
		//logger.debug("tm1  ", targetMessage);
		message.delete().catch((err) => logger.error("issue while deleting above-submission message ", err.toString()));
		if (bug) handleSubmission(targetMessage, "bug");
		if (submission) handleSubmission(targetMessage, "suggestion");
		return;
	}*/

	if (bug) handleSubmission(message, "bug");
	if (suggestion) handleSubmission(message, "suggestion");
}

async function handleReply(message: Message, suggestion: boolean, bug: boolean): Promise<boolean> {
	//special case for replying with the ping only
	let content = message.content.replaceAll(/<@&\d+>/gi, "").trim()
	if (content !== "")
		return false;

	const targetID = message.reference?.messageId;
	if (targetID === undefined)
		return false;

	const targetMessage = await message.channel.messages.fetch(targetID);
	await message.delete()

	if (bug) handleSubmission(targetMessage, "bug");
	if (suggestion) handleSubmission(targetMessage, "suggestion");

	return true;
}

function handleSubmission(msg: Message, type: "suggestion" | "bug"): void {
	logger.info("handling submission: " + msg.content + " of type " + type);

	//save info to local file
	createFile(msg, type);

	//add reactions
	msg.react("🤖")
		.then(() => msg.react("👍"))
		.then(() => msg.react("👎"))
		.then(() => msg.react("❌"))
		.catch((err) => logger.error("issue while adding reactions :( " + err.toString()));
}

function createFile(msg: Message | PartialMessage, subDirectory: "suggestion" | "bug"): void {
	//subDirectory should be either suggestion or bug
	const msgTitle: string = msg.id + ".json";
	const msgLink: string = "https://discordapp.com/channels/" + msg.guild?.id + "/" + msg.channel?.id + "/" + msg.id;
	const msgJson: any = {
		"link": msgLink,
		"type": subDirectory,
		"author": msg.author?.tag,
		"msg": msg.content
	};
	fs.writeFile("./data/" + subDirectory + "s/" + msgTitle, JSON.stringify(msgJson, null, 4), function (err) {
		if (err) throw err;
		logger.info("saved to file: " + msgTitle);
	});
}

function scanAndRemoveFile(msg: Message | PartialMessage): void {
	const msgTitle = msg.id + ".json";
	//suggestions
	fs.access("./data/suggestions/" + msgTitle, (err) => {
		if (err) logger.warn("could not find ./data/suggestions/" + msgTitle + "  didnt't delete");
		else removeFile(msgTitle, "suggestion");
	});
	//bugs
	fs.access("./data/bugs/" + msgTitle, (err) => {
		if (err) logger.warn("could not find ./data/bugs/" + msgTitle + "  didnt't delete");
		else removeFile(msgTitle, "bug");
	});
}

function removeFile(title: string, subDirectory: "suggestion" | "bug"): void {
	//subDirectory should be either suggestion or bug
	fs.unlink("./data/" + subDirectory + "s/" + title, (err) => {
		if (err) logger.error("issue while removing file ", err);
		else logger.info("removed file: " + title + " of type " + subDirectory);
	});
}
