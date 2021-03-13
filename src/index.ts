import * as config from "./config.json";
import {logger} from "./logger";
import type {Message, PartialMessage} from "discord.js";
import {CollectorFilter, GuildMember, MessageEmbed, Snowflake} from "discord.js";
import {client} from "./client";

//adding and removing submissions
import "./submission";

//list all submissions
import "./list";

//server commands
import "./server";

//let people self assign roles
import "./roles"

const rolesThatCanRemoveSubmissions: Snowflake[] = config.rolesThatCanRemoveSubmissions;

client.on("message", (msg: Message | PartialMessage) => {
	if (msg.author?.bot) return;

	if (msg.guild === null) {
		logger.info("Got a DM: " + msg.content);
		return;
	}
});

//blameoptifine command
client.on("message", (msg: Message | PartialMessage) => {
	if (msg.author?.bot) return;

	if (!(msg.content?.startsWith("!blameoptifine"))) return;

	let embed: MessageEmbed = new MessageEmbed()
		.setDescription("If you have Optifine installed, make sure your forge version is set to either **28.2.0** or **28.1.54**, others are likely to conflict with it and will crash the game while launching. See [this issue](https://github.com/sp614x/optifine/issues/3561#issuecomment-602196539) for more info")
		.setColor(1146986);

	msg.channel?.send(embed).catch(err => logger.error("issue while sending blameoptifine response" + err.toString()));
})


//display link the the spreadsheet
client.on("message", (msg: Message | PartialMessage) => {
	if (msg.author?.bot) return;

	if (!(msg.content?.startsWith("!suggested"))) return;

	let embed: MessageEmbed = new MessageEmbed()
		.setDescription("Great minds think alike! Please make sure to Ctrl+F on [this spreadsheet](https://docs.google.com/spreadsheets/d/1pwX1ZlIIVeLoPXmjNl3amU4iPKpEcbl4FWkOzmYZG5w) to check whether your idea has been suggested before. Thank you!")
		.setColor(6724095);

	msg.channel?.send(embed).catch(err => logger.error("issue while sending suggested reply" + err.toString()));

});

//bulk delete command
client.on("message", async (message: Message | PartialMessage) => {
	if (message.author?.bot) return;

	let msg: Message;

	if (message.partial)
		msg = await message.fetch();
	else
		msg = message as Message;

	const match = msg.content?.match(/^!delete(?: (\d+))(?:( confirm)?)/i);
	if (!match) return;

	logger.debug("delete command issued");

	if (!msg.author) return;
	let member: GuildMember | null | undefined = msg.guild?.member(msg.author.id);
	if (!member) return;

	let allowed = member.roles.cache.some(role => rolesThatCanRemoveSubmissions.includes(role.id));
	if (!allowed) return;

	logger.debug("user has sufficient permission");

	let amount = parseInt(match[1]);
	if (isNaN(amount)) {
		await msg.reply("sorry, but your input don't look like a number to me");
		return;
	}

	if (amount < 1) {
		await msg.reply(" " + amount + " .. you serious?");
		return;
	}

	if (amount > 95) {
		await msg.reply("sorry, but that's a little too much for me (95 max)");
		return;
	}

	let confirmed: boolean = match[2] !== undefined;

	if (confirmed) {
		deleteMessages(amount + 1, msg);
		return;
	}

	logger.debug("deletion has to be confirmed first");

	// confirm first
	const embed: MessageEmbed = new MessageEmbed()
		.setDescription("Sure you want to delete " + amount + " messages here?")
		.setColor(6724095)
		.addField("YEP", "Click on the ✅ Checkmark to confirm")

	let replyMsg: Message = await msg.reply(embed);
	replyMsg.react("✅").catch(err => logger.error("issue while adding reactions :(", err));
	const filter: CollectorFilter = (reaction, user) => {
		//logger.debug("filter: u.id:"+user.id + "  a.id:"+msg.author.id);
		return reaction.emoji.name === "✅" && user.id === msg.author.id;
	};

	replyMsg.awaitReactions(filter, {max: 1, time: 15000, errors: ["time"]})
		.then(_collected => {
			//logger.debug("collection success");
			deleteMessages(amount + 2, msg);

		})
		.catch(_collected => {
			replyMsg.delete();
			msg.delete();
		});


});

function deleteMessages(amount: number, msg: Message): void {
	logger.info("user + " + msg.author.tag + " issued message deletion!");
	msg.channel.bulkDelete(amount, true).then(async collection => {
		let embed: MessageEmbed = new MessageEmbed()
			.setDescription("🧹 Swept " + collection.size + " messages under the rug for you 🧹");
		let replyMsg = await msg.channel.send(embed);

		setTimeout(() => replyMsg.delete(), 5000);
	}).catch(err => {
		logger.error(err);
		msg.channel.send("error while trying to delete messages here :(");
	});
}

//catch unhandled promise rejections
process.on("unhandledRejection", err => logger.error("unhandled promise rejection: " + err));

//login to the bot
client.login(config.token).catch(err => logger.error("issue during login" + err.toString()));
