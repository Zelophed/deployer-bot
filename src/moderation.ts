import {logger} from "./logger";
import {client} from "./client";
import {GuildMember, Snowflake, TextChannel} from "discord.js";
import * as fs from "fs";
import importFresh = require("import-fresh");

type mute = { id: Snowflake, name: String };
type mutes = { users: mute[] };

const mutedRoleId = "732990400637435915";
const modPrefix = "[Moderation] ";

client.on("guildMemberUpdate", async (oldMember, newMember) => {
	if (oldMember.partial) oldMember = await oldMember.fetch();
	if (newMember.partial) newMember = await newMember.fetch();

	const wasMuted: boolean = oldMember.roles.cache.has(mutedRoleId);
	const isMuted: boolean = newMember.roles.cache.has(mutedRoleId);

	logger.debug("member Update: " + newMember.toString() + " (" + newMember.user.tag + ")");

	if (wasMuted !== isMuted) {
		updateMuteStatus(newMember, isMuted);
	}


});

function updateMuteStatus(member: GuildMember, isMuted: boolean) {
	const mutes = <mutes>importFresh("./data/mutes.json");

	if (isMuted) {
		addMute(mutes, member);
		message("User " + member.toString() + " (" + member.user.tag + ") has been muted", true, false);
	} else {
		let index = mutes.users.findIndex(mute => mute.id === member.id);
		if (index !== -1) {
			mutes.users.splice(index, 1);
			fs.writeFile("./data/mutes.json", JSON.stringify(mutes, null, 4), function (err) {
				if (err) throw err;
				logger.info("removed user " + member.id + " from the mutes list");
			});
		}

		message("User " + member.toString() + " (" + member.user.tag + ") has been un-muted", true, false);
	}

}

client.on("guildMemberAdd", async member => {
	if (member.partial) member = await member.fetch();

	logger.debug("member Join: " + member.toString() + " (" + member.user.tag + ")");

	const mutes = <mutes>importFresh("./data/mutes.json");
	if (mutes.users.find(mute => mute.id === member.id)) {
		//add mute role back
		member.roles.add(mutedRoleId).catch(err => logger.error("issue while adding mute role to joining member: " + err.toString()));

		message("Previously muted User " + member.toString() + " (" + member.user.tag + ") rejoined the guild, adding mute role");
	}
});

client.on("guildMemberRemove", async member => {
	if (member.partial) member = await member.fetch();

	logger.debug("member Leave: " + member.toString() + " (" + member.user.tag + ")");

	const isMuted: boolean = member.roles.cache.has(mutedRoleId);
	if (!isMuted) return;

	const mutes = <mutes>importFresh("./data/mutes.json");
	addMute(mutes, member);
	message("Muted User " + member.toString() + " (" + member.user.tag + ") has left the guild", true, false);
})

function addMute(mutes: mutes, member: GuildMember) {
	if (mutes.users.find(mute => mute.id === member.id) === undefined) {
		mutes.users.push({id: member.id, name: member.user.tag});
		fs.writeFile("./data/mutes.json", JSON.stringify(mutes, null, 4), function (err) {
			if (err) throw err;
			logger.info("added user " + member.id + " to the mutes list");
		});
	}
}

function message(message: string, log: boolean = true, discord: boolean = true): void {
	if (log) logger.info(modPrefix + message);

	if (!discord) return;

	const channel_id: string = "692400012650610688"; //#bot-spam
	client.channels.fetch(channel_id)
		.then((channel: TextChannel) => channel.send(message))
		.catch((err: any) => logger.error(err));
}