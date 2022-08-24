
import * as events from "events";
import {client} from "./client";
import type {ColorResolvable, Message, MessageEmbed, PartialMessage, TextChannel} from "discord.js";
import * as Discord from "discord.js";

import {capitalizeFirstLetter, Node} from "./util";
import {logger} from "./logger";
import type {EventEmitter} from "events";

import {ServerStatus} from "./types/lib";

export const serverEvents: EventEmitter = new events.EventEmitter();
export let performingUpdate = false;
export function setUpdatingStatus(running: boolean) {
	performingUpdate = running;
}

export function updateStatusMessage(status: ServerStatus, node: Node) {
	logger.debug("updating server status message");

	const embed: MessageEmbed = new Discord.MessageEmbed()
			.setTitle("Current Server Status")
			.setFooter("Last Update")
			.setTimestamp()
			.setColor(getColorForStatus(status));

	embed.addField("This is the channel for", node.name);
	embed.addField("Label", node.label);
	embed.addField("Server Status", capitalizeFirstLetter(status));

	client.channels.fetch(node.channelID)
			.then((channel: TextChannel) => {
				channel.messages.fetch(node.messageID)
						.then((msg: Message) => {
							msg.edit({
								embeds: [ embed ]
							}).then(() => logger.debug("Status message for " + node.name + " updated!"))
								.catch(err => logger.error("Unable to update Status message for " + node.name, err))
						}).catch(err => logger.error("Unable to fetch Status message for " + node.name, err));
			}).catch(err => logger.error("Unable to fetch channel for " + node.name, err));
}

//servermodlocator cert request
client.on("message", async (message: Message | PartialMessage) => {
	let msg: Message
	if (message.partial)
		msg = await message.fetch();
	else
		msg = message as Message;

	if (msg.author?.bot) return;

	let node: Node;
	if (message.channel.id == Node.nodeA.channelID) {
		node = Node.nodeA;
	} else if (message.channel.id == Node.nodeB.channelID) {
		node = Node.nodeB;
	} else {
		return;
	}

	if (!msg.attachments || msg.attachments.size < 1) return;

	let file = msg.attachments.first();
	if (!file || !file.name?.endsWith(".csr")) return;

	//setup
	let embed: MessageEmbed = new Discord.MessageEmbed()
			.setDescription("Servermodlocator");

	let errorTimeout = setTimeout(() => {
		serverEvents.removeAllListeners("certificateResponse");
		embed.addField("Failed", "Request took longer than 90 seconds, probably failed. sadge");
		msg.reply({
			embeds: [ embed ]
		});
	}, 90000);

	serverEvents.removeAllListeners("certificateResponse");
	serverEvents.once("certificateResponse", (data: any) => {
		clearTimeout(errorTimeout);

		if (!data.success) {
			embed.addField("Failed", "Something went wrong while executing your request. Sorry :(");
			msg.reply({
				embeds: [ embed ]
			});

			return;
		}

		let certbuff = Buffer.from(data.cert.data);
		let tomlbuff = Buffer.from(data.toml.data);

		embed.addField("Success", "Thanks for submitting. Here's your very own certificate.");
		embed.addField("Files", "Place these files in your \`instance/servermods\` folder and you're ready to Launch!");
		msg.reply({
			embeds: [ embed ],
			files: [
				{
					attachment: certbuff,
					name: "servercert.pem"
				},
				{
					attachment: tomlbuff,
					name: "serverpacklocator.toml"
				}
			]
		});


	});

	//todo send request to node
});

export function getColorForStatus(status: ServerStatus): ColorResolvable {
	if (status === "stopped") return "ORANGE";
	if (status === "starting") return "DARK_GOLD";
	if (status === "running") return "DARK_GREEN";
	if (status === "errored") return "DARK_VIVID_PINK";
	return "GREY";
}