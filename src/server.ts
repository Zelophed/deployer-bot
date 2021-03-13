
import ipc = require("node-ipc");
//import request = require("request");
import events = require("events");
import {client} from "./client";
import type {ColorResolvable, Message, MessageEmbed, PartialMessage, TextChannel} from "discord.js";
import * as Discord from "discord.js";

import * as util from "./util";
import {Node} from "./util";
import {logger} from "./logger";
import type {EventEmitter} from "events";

import * as config from "./config.json";
import {DatedFile} from "../../tsCommon/src/lib";
import {CompositeServerStatus, UpdateInfo, MessageChannel} from "../../tsCommon/src/ipcResponseTypes";

//base link to ci page
//const urlNoJob: string = "http://ci.tterrag.com/job/Create/";

const validCommandChannels: Array<string> = config.validCommandChannels;

ipc.config.id = "deployerBotLive";
ipc.config.retry = 60000;

//local version of the server status, gets updated every time we get an event from the manager socket
const statusEmbed: MessageEmbed = new Discord.MessageEmbed()
	.setTitle("Current Server Status")
	.setFooter("Last Update")
	.setTimestamp();

Node.nodes.forEach((node) => {
	statusEmbed.addField(node.name + "(" + node.label + ")", "?");
})

let updateTimeout: NodeJS.Timeout | null;

function emit(node: Node, event: string, data?: any) {
	ipc.of["manager-" + node.name].emit(event, data);
}

function updateStatusMessage(data: CompositeServerStatus, node: Node) {
	logger.debug("updating server status message");
	let buildInfo: string = data.buildUrl ? "[#" + data.build + "](" + data.buildUrl + ")" : "#" + data.build;

	statusEmbed.fields[Node.nodes.indexOf(node)].value = data.status + " | " + buildInfo;
	statusEmbed.setTimestamp();
	statusEmbed.setColor(getColorForStatus(data.status));

	if (updateTimeout) clearTimeout(updateTimeout);
	updateTimeout = setTimeout(() => {
		client.channels.fetch("692400012650610688")
			.then((channel: TextChannel) => channel.messages.fetch("730519740463710440")
				.then((message: Message) => {
					//logger.debug("message: " + message.content);
					//logger.debug("embed:" + JSON.stringify(statusEmbed));
					message.edit(statusEmbed)
						.then(() => logger.debug("message contents updated"))
						.catch(err => logger.error("unable to update message;; " + err));
				})
				.catch(err => logger.error("issue while fetching message;; " + err)))
			.catch(err => logger.error("issue while fetching channel;; " + err));
		updateTimeout = null;
	}, 500);
}

const serverEvents: EventEmitter = new events.EventEmitter();

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
	});
});

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


	statusMsg = await msg.channel.send({embed});

	await new Promise((resolve) => {
		serverEvents.once("infoReply", (data: CompositeServerStatus) => {
			embed.addField("Server Info", "Status: " + data.status + " | Build: #" + data.build);
			statusMsg.edit(embed);
			resolve();
		});
		emit(<Node>node, "getInfo");
	});

	let errorTimeout = setTimeout(() => {
		serverEvents.removeAllListeners("updateInfo");
		embed.addField("Failed", "Update took longer than 90 seconds, probably failed. sadge");
		statusMsg.edit(embed);
	}, 90000)

	serverEvents.removeAllListeners("updateInfo");
	serverEvents.on("updateInfo", (data: UpdateInfo) => {
		if (data.status == "failed") {
			if (data.info === "versionNotNew")
				embed.addField("Aborted", "Server is already running with the latest version (" + data.version + ")")
			else {
				embed.addField("Failed", "Something went wrong: " + data.info + "; feel free to ping Zelo :)");
			}

			serverEvents.removeAllListeners("updateInfo");
			statusMsg.edit(embed);
			clearTimeout(errorTimeout);
			return;
		}
		if (data.status == "complete") {
			embed.addField("Almost Done", "Waiting for Server to start ..");
			serverEvents.removeAllListeners("updateInfo");
			statusMsg.edit(embed);
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

				statusMsg.edit(embed);

				serverEvents.removeListener("stateChanged", stateChange);
			};
			serverEvents.on("stateChanged", stateChange);

			logger.info("update complete")

			return;
		}

		//data.status == "running"
		if (data.info == "newVersion") {
			embed.addField("New Version", "[#" + data.version + "](" + data.url + ")");
			statusMsg.edit(embed);
		}

	});

	emit(node, "updateServer");
});

client.on("message", async (msg: Message | PartialMessage) => {
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
		msg.channel?.send(node?.name + " | Date: " + data.mtime, {
			files: [{
				attachment: "../../minecraft/managedServers/" + node?.name + "/crash-reports/" + data.name,
				name: data.name
			}]
		}).catch(err => logger.error("issue while sending reply" + err));
	});
	ipc.of["manager-" + node.name].emit("getCrash");
});

async function getNode(match: RegExpMatchArray, msg: Message | PartialMessage): Promise<Node | undefined> {
	let find = matchNode(match[1]);

	if (find) return find;

	return await askForNode(msg);
}

function askForNode(msg: Message | PartialMessage): Promise<Node | undefined> {
	return new Promise(((resolve, reject) => {
		if (!msg.reply || !msg.channel) {
			reject(undefined);
			return;
		}

		msg.reply("What Server is that command for? [" + Node.nodes.map(node => node.name).join(", ") + "] \nJust reply with the name, no need to type the command again ;)");
		msg.channel.awaitMessages(m => matchNode(m.content) !== undefined, { max: 1, time: 60000, errors: ["time"] })
			.then((collected) => {
				let node = matchNode(collected.last()?.content ?? "");
				if (!node) reject(undefined);

				resolve(node);

			}).catch((err) => {
			logger.error(err);
			reject(err);
		});
	}))

}

function matchNode(cmp: string): Node | undefined {
	if (!cmp) return undefined;
	logger.debug("trying to match a node: ", cmp);

	return Node.nodes.find((node, index) => {
		if (index.toString() == cmp) return true;
		if (node.alias.toLowerCase() == cmp.toLowerCase()) return true;
		return node.name.toLowerCase() == cmp.toLowerCase();
	});
}

function sendMessageToChannel(data: MessageChannel): void {
	const id: string = data.channelID ?? "692400012650610688"; //bot-spam
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