import {logger} from "./logger";
import {client} from "./client";
import {config} from "./config.js";
import {
	GuildMember,
	MessageReaction,
	PartialUser, Snowflake,
	User
} from "discord.js";

const roleAssign = config.roleAssign;

client.on("messageReactionAdd", async (reaction: MessageReaction, user: User | PartialUser) => {
	if (reaction.partial) {
		try {
			await reaction.fetch();
		} catch (err) {
			logger.error("error while fetching reaction partial: " + err.toString());
			return;
		}
	}

	if (user.bot) return;

	logger.debug("reaction emoji: " + reaction.emoji.name?.toString());

	let member: GuildMember | null | undefined = reaction.message.guild?.members.cache.get(user.id);
	if (!member) return;
	logger.debug("reactor is a valid guild member.. iterating configured messages")

	roleAssign.forEach((entry) => {
		if (reaction.message.channel.id !== entry.channelID) return;
		if (reaction.message.id !== entry.messageID) return;
		logger.debug("reaction matched role assign message and channel id .. iterating configured roles")

		entry.roles.forEach((pair) => {
			if (pair.emoji !== reaction.emoji.name) return;

			logger.debug("match found! " + pair.emoji + "..  " + pair.roleID);
			const role = reaction.message.guild?.roles.cache.get(<Snowflake>pair.roleID);
			if (role) {
				member?.roles.add(role);
				logger.info("added role " + role.name + " to user " + member?.user.tag);
			}
		});
	});
})
