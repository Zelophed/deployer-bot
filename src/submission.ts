import * as config from "./config.json";

import * as fs from "fs";

import {client} from "./client.js";
import {logger} from "./logger.js";
import * as util from "./util.js";
import importFresh = require("import-fresh");
import type {CollectorFilter, Message, PartialMessage, PartialUser, Snowflake} from "discord.js";
import {GuildMember, MessageEmbed, MessageReaction, TextChannel, User} from "discord.js";

const validSubmissionChannels: Snowflake[] = config.validSubmissionChannels;
const rolesThatCanRemoveSubmissions: Snowflake[] = config.rolesThatCanRemoveSubmissions;
const roleSuggestionId: Snowflake = config.roleSuggestionId;
const roleBugId: Snowflake = config.roleBugId;

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

	//logger.debug("correct emoji");

	let member: GuildMember | null | undefined = reaction.message.guild?.member(user.id);
	if (!member) return;

	//logger.debug("member ", member);
	if (!reaction.message.reactions.cache.some((react: MessageReaction) => react.emoji.name === "🤖")) return;

	//check if member has special role;
	let allowedToRemove: boolean = reaction.message.author.id === user.id;
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

	let submission: boolean = false;
	let bug: boolean = false;
	if (roles.get(roleSuggestionId)) submission = true;
	if (roles.get(roleBugId)) bug = true;

	if (!(submission || bug)) return;

	const match: RegExpMatchArray | null = message.content.match(/^<@&\d+> above (\d+)$/);
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
	}

	if (bug) handleSubmission(message, "bug");
	if (submission) await confirmSuggestion(message);
}

async function confirmSuggestion(msg: Message): Promise<void> {

	if (!isFirstSuggestion(msg.author)) {
		handleSubmission(msg, "suggestion");
		return;
	}

	const embed: MessageEmbed = new MessageEmbed()
		.setDescription("You are about to submit your first suggestion. I'm sure its a great idea, but maybe you aren't the first one to have it, check [this](https://docs.google.com/spreadsheets/d/1pwX1ZlIIVeLoPXmjNl3amU4iPKpEcbl4FWkOzmYZG5w) spreadsheet to see if its already suggested.\nTry searching for keywords with ctrl + F :)")
		.setColor(6724095)
		.addField("Confirm", "Click on the ✅ Checkmark to confirm your submission")
		.addField("Nevermind", "You have 5 minutes to confirm your submission, otherwise it will just get deleted")
		.addField("Only once", "This message will NOT appear on your future submission. If you need to check the spreadsheet again type `!suggested`");

	let replyMsg: Message = await msg.reply(embed);
	replyMsg.react("✅").catch(err => logger.error("issue while adding reactions :(", err));
	const filter: CollectorFilter = (reaction, user) => {
		//logger.debug("filter: u.id:"+user.id + "  a.id:"+msg.author.id);
		return reaction.emoji.name === "✅" && user.id === msg.author.id;
	};
	replyMsg.awaitReactions(filter, {max: 1, time: 300000, errors: ["time"]})
		.then(_collected => {
			//logger.debug("collection success");
			let embed: MessageEmbed = new MessageEmbed()
				.setDescription("Thank you for your contribution!");
			replyMsg.edit(embed);
			handleSubmission(msg, "suggestion");
			addUserToList(msg.author);
			setTimeout(() => replyMsg.delete(), 5000);
		})
		.catch(_collected => {
			replyMsg.delete();
			msg.delete();
		});

}

function isFirstSuggestion(user: User): boolean {
	const users: any = importFresh("./data/users.json");
	//logger.debug("list: ",users.suggestors);
	return !users.suggestors.includes(user.id);
}

function addUserToList(user: User): void {
	const users: any = importFresh("./data/users.json");
	users.suggestors.push(user.id);
	fs.writeFile("./data/users.json", JSON.stringify(users, null, 4), function (err) {
		if (err) throw err;
		logger.info("added user " + user.id + " to the suggestions list");
	});
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
