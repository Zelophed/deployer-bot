
import ipc = require("node-ipc");
import events = require("events");
import {client} from "./client";
import type {ColorResolvable, Message, MessageEmbed, PartialMessage, Snowflake, TextChannel} from "discord.js";
import * as Discord from "discord.js";

import * as util from "./util";
import {Node} from "./util";
import {logger} from "./logger";
import type {EventEmitter} from "events";

import * as config from "./config.json";
import {DatedFile} from "../../tsCommon/src/lib";
import {CompositeServerStatus, UpdateInfo, MessageChannel} from "../../tsCommon/src/ipcResponseTypes";

const validCommandChannels: Array<string> = config.validCommandChannels;

ipc.config.id = "deployerBotLive";
ipc.config.retry = 60000;

export const serverEvents: EventEmitter = new events.EventEmitter();

export function emit(node: Node, event: string, data?: any) {
	ipc.of["manager-" + node.name].emit(event, data);
}

function updateStatusMessage(data: CompositeServerStatus, node: Node) {
	logger.debug("updating server status message");

	const embed: MessageEmbed = new Discord.MessageEmbed()
			.setTitle("Current Server Status")
			.setFooter("Last Update")
			.setTimestamp()
			.setColor(getColorForStatus(data.status));

	embed.addField("This is the channel for", node.name);
	embed.addField("Label", node.label);
	embed.addField("Server Status", data.status);

	client.channels.fetch(node.channelID)
			.then((channel: TextChannel) => {
				channel.messages.fetch(node.messageID)
						.then((msg: Message) => {
							msg.edit({
								content: "",
								embeds: [ embed ]
							}).then(() => logger.debug("Status message for " + node.name + " updated!"))
								.catch(err => logger.error("Unable to update Status message for " + node.name, err))
						}).catch(err => logger.error("Unable to fetch Status message for " + node.name, err));
			}).catch(err => logger.error("Unable to fetch channel for " + node.name, err));
}

Node.nodes.forEach((node) => {
	const name = "manager-" + node.name
	ipc.connectTo(name, () => {
		ipc.of[name].on('connect', () => {
			ipc.of[name].emit("setDiscordProcess");

			setTimeout(() => ipc.of[name].emit("getInfo"), 2500);
		});
		ipc.of[name].on('disconnect', () => {
			logger.info("disconnected from server " + name);
		});
		ipc.of[name].on("infoReply", (data: CompositeServerStatus) => {
			logger.info("infoReply: " + data);
			updateStatusMessage(data, node);

			serverEvents.emit("infoReply", data);
		});
		ipc.of[name].on("updateInfo", (data: UpdateInfo) => {
			logger.info("updateInfo", data);

			serverEvents.emit("updateInfo", data);
		});
		ipc.of[name].on("serverStateChanged", (data: CompositeServerStatus) => {
			logger.info("serverStateChanged" + data);
			updateStatusMessage(data, node);

			serverEvents.emit("stateChanged", data, node);
		});
		ipc.of[name].on("messageChannel", (data: MessageChannel) => {
			logger.info("sending message: " + data.message);
			sendMessageToChannel(data);
		});
		ipc.of[name].on("crashReply", (data: DatedFile) => {
			logger.info("crashReply: " + data);

			serverEvents.emit("crashReply", data);
		});
		ipc.of[name].on("certificateResponse", (data: any) => {
			logger.info("certificateResponse: " + data);

			serverEvents.emit("certificateResponse", data);
		});
	});
});

/*
//update server command
client.on("message", async (msg: Message | PartialMessage) => {
	if (msg.author?.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	//if (!(msg.content?.startsWith("!updateServer"))) return;
	const match = msg.content?.match(/^!update(?:Server)?(?: (\S+)?|$)/i);

	if (!match) return;

	let node = await getNode(match, msg);

	if (!node) return;

	if (node.name == "nodeC") {
		msg.channel?.send("sorry, automatic updating is currently not supported on this server")

		return;
	}

	let statusMsg: Discord.Message;
	let embed: MessageEmbed = new Discord.MessageEmbed()
		.setDescription("Updating Create on " + node.name + "(" + node.label + ") ...");

	if (msg.partial)
		msg = await msg.fetch();


	statusMsg = await msg.channel.send({
		embeds: [ embed ]
	});

	await new Promise<void>((resolve) => {
		serverEvents.once("infoReply", (data: CompositeServerStatus) => {
			embed.addField("Server Info", "Status: " + data.status + " | Build: #" + data.build);
			statusMsg.edit({
				embeds: [ embed ]
			});
			resolve();
		});
		emit(<Node>node, "getInfo");
	});

	let errorTimeout = setTimeout(() => {
		serverEvents.removeAllListeners("updateInfo");
		embed.addField("Failed", "Update took longer than 90 seconds, probably failed. sadge");
		statusMsg.edit({
			embeds: [ embed ]
		});
	}, 90000);

	serverEvents.removeAllListeners("updateInfo");
	serverEvents.on("updateInfo", (data: UpdateInfo) => {
		if (data.status == "failed") {
			if (data.info === "versionNotNew")
				embed.addField("Aborted", "Server is already running with the latest version (" + data.version + ")")
			else {
				embed.addField("Failed", "Something went wrong: " + data.info + "; feel free to ping Zelo :)");
			}

			serverEvents.removeAllListeners("updateInfo");
			statusMsg.edit({
				embeds: [ embed ]
			});
			clearTimeout(errorTimeout);
			return;
		}
		if (data.status == "complete") {
			embed.addField("Almost Done", "Waiting for Server to start ..");
			serverEvents.removeAllListeners("updateInfo");
			statusMsg.edit({
				embeds: [ embed ]
			});
			clearTimeout(errorTimeout);

			let firstStop = true;

			const stateChange = (data: CompositeServerStatus): void => {
				if (data.status == "starting") return;

				if (data.status == "running") embed.addField("YEP", "Server started successfully");

				if (data.status == "stopped") {
					if (firstStop) {
						firstStop = false;
						return;
					}

					embed.addField("NOPE", "Server was unable to start, check the latest crash with !crash " + node?.name);
				}

				statusMsg.edit({
					embeds: [ embed ]
				});

				serverEvents.removeListener("stateChanged", stateChange);
			};
			serverEvents.on("stateChanged", stateChange);

			logger.info("update complete")

			return;
		}

		//data.status == "running"
		if (data.info == "newVersion") {
			embed.addField("New Version", "[#" + data.version + "](" + data.url + ")");
			statusMsg.edit({
				embeds: [ embed ]
			});
		}

	});

	emit(node, "updateServer");
});*/

/*client.on("message", async (msg: Message | PartialMessage) => {
	if (msg.author?.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	//if (!(msg.content?.startsWith("!serverStatus"))) return;
	const match = msg.content?.match(/^!serverStatus(?: (\S+)?|$)/i);

	if (!match) return;

	let node = await getNode(match, msg);

	if (!node) {
		Node.nodes.forEach((node) => {
			const name = "manager-" + node.name;
			ipc.of[name].emit("getInfo");
		});
	} else {
		ipc.of["manager-" + node.name].emit("getInfo");
	}

	//msg.channel?.send("currently wip").catch(err => logger.error("issue while sending message during status command " + err.toString()));
});

client.on("message", async (msg: Message | PartialMessage) => {
	if (msg.author?.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	//if (!(msg.content?.startsWith("!serverStatus"))) return;
	const match = msg.content?.match(/^!whitelist(?: (.*))/i);

	if (!match) return;
	logger.debug(match);

	ipc.of["manager-" + Node.nodeB.name].emit("whitelist", {username: match[1]});
});

client.on("message", async (msg: Message | PartialMessage) => {
	if (msg.author?.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	//if (!(msg.content?.startsWith("!stopServer"))) return;
	const match = msg.content?.match(/^!stop(?:Server)?(?: (\S+)?|$)/i);

	if (!match) return;

	let node = await getNode(match, msg);

	if (!node) return;

	ipc.of["manager-" + node.name].emit("stopServer");

	msg.reply?.("Sent to " + node.name + "!").catch(err => logger.error("issue while replying to stop command " + err.toString()));
});

client.on("message", async (msg: Message | PartialMessage) => {
	if (msg.author?.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	//if (!(msg.content?.startsWith("!restartServer"))) return;
	const match = msg.content?.match(/^!restart(?:Server)?(?: (\S+)?|$)/i);

	if (!match) return;

	let node = await getNode(match, msg);

	if (!node) return;

	ipc.of["manager-" + node.name].emit("restartServer");

	msg.reply?.("Sent to " + node.name + "!").catch(err => logger.error("issue while replying to restart command " + err.toString()));
});

client.on("message", async (msg: Message | PartialMessage) => {
	if (msg.author?.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	//if (!(msg.content?.startsWith("!crash"))) return;
	const match = msg.content?.match(/^!crash(?: (\S+)?|$)/i);

	if (!match) return;

	let node = await getNode(match, msg);

	if (!node) return;

	serverEvents.removeAllListeners("crashReply");
	serverEvents.once("crashReply", (data: DatedFile) => {
		let s = node?.name + " | Date: " + data.mtime;
		msg.channel?.send({
			content: s,
			files: [{
				attachment: "../../minecraft/managedServers/" + node?.name + "/crash-reports/" + data.name,
				name: data.name
			}]
		}).catch(err => logger.error("issue while sending reply" + err));
	});
	ipc.of["manager-" + node.name].emit("getCrash");
});*/

client.on("message", async (message: Message | PartialMessage) => {
	let msg: Message
	if (message.partial)
		msg = await message.fetch();
	else
		msg = message as Message;

	if (msg.author?.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

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

	ipc.of["manager-" + Node.nodeB.name].emit("setupCertificate", {
		url: file.url
	});
});

function sendMessageToChannel(data: MessageChannel): void {
	const id: Snowflake = <Snowflake>data.channelID ?? "692400012650610688"; //bot-spam
	client.channels.fetch(id)
		.then((channel: TextChannel) => channel.send(data.message))
		.catch((err: any) => logger.error(err));
}

function getColorForStatus(status: string): ColorResolvable {
	if (status == "stopped") return "DARK_VIVID_PINK";
	if (status == "starting") return "DARK_GOLD";
	if (status == "running") return "DARK_GREEN";
	return "WHITE"
}