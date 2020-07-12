import fs = require("fs");
import ipc = require("node-ipc");
import request = require("request");
import events = require("events");
import {client} from "./client";
import * as Discord from "discord.js";

import * as util from "./util";
import {logger} from "./logger";

import type {ColorResolvable, Message, MessageEmbed, PartialMessage, TextChannel} from "discord.js";
import type {EventEmitter} from "events";
import type {WriteStream} from "fs";

import * as config from "./config.json";

const validCommandChannels: Array<string> = config.validCommandChannels;

ipc.config.id = "deployerBotLive";
ipc.config.retry = 10000;

const sendMessageToChannel = function (data): void {
	client.channels.fetch("692400012650610688")
		.then((channel :TextChannel) => channel.send(data.message))
		.catch((err: any) => logger.error(err));
};

//local version of the server status, gets updated every time we get an event from the manager socket
const statusEmbed: MessageEmbed = new Discord.MessageEmbed()
	.setTitle("Current Server Status")
	.setFooter("Last Update")
	.setTimestamp()
	.addField("Status:", "?")
	.addField("Build:", "?");

let updateTimeout: NodeJS.Timeout;

function updateStatusMessage(data) {
	logger.debug("updating server status message");
	statusEmbed.fields[0].value = data.status;
	statusEmbed.fields[1].value = data.build;
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

ipc.connectTo('createManager', () => {
	ipc.of.createManager.on('connect', () => {
		ipc.of.createManager.emit("setDiscordProcess");

		setTimeout(() => ipc.of.createManager.emit("getInfo"), 2500);
	});
	ipc.of.createManager.on('disconnect', () => {
		logger.info("disconnected from server manager");
	});
	ipc.of.createManager.on("infoReply", (data) => {
		logger.info("infoReply: " + data);
		updateStatusMessage(data);

		serverEvents.emit("infoReply", data);
	});
	ipc.of.createManager.on("updateResult", (data) => {
		logger.info("updateComplete");

		serverEvents.emit("updateResult", data);
	})
	ipc.of.createManager.on("serverStateChanged", (data) => {
		logger.info("serverStateChanged" + data);
		updateStatusMessage(data);

		serverEvents.emit("stateChanged", data);
	})
	ipc.of.createManager.on("messageChannel", (data) => {
		logger.info("sending message: " + data.message);
		sendMessageToChannel(data);
	})
	ipc.of.createManager.on("crashReply", (data) => {
		logger.info("crashReply: " + data);

		serverEvents.emit("crashReply");
	})
});

//update server command
client.on("message", async msg => {
	if (msg.author.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	if (!msg.content.startsWith("!updateServer")) return;

	let statusMsg: Discord.Message;
	let embed: MessageEmbed = new Discord.MessageEmbed()
		.setDescription("updating server ...");

	statusMsg = await msg.channel.send({embed});

	let currentVersion: number = 0;
	await new Promise((resolve) => {
		serverEvents.once("infoReply", (data) => {
			embed.addField("Server Info", "Status: " + data.status + " | Build: #" + data.build);
			currentVersion = data.build;
			statusMsg.edit(embed);
			resolve();
		});
		ipc.of.createManager.emit("getInfo");
	});

	const urlBase: string = "http://ci.tterrag.com/job/Create/job/1.15-dev/lastStableBuild";
	logger.debug("performing request to ci base url");
	const res = await doRequest(urlBase + "/api/json");
	logger.debug("request complete");
	const data: any = JSON.parse(res);
	const jenkinsVersion: number = data.number;
	if (!jenkinsVersion) {
		statusMsg.edit("error retrieving latest build version from CI").catch(err => logger.error("issue while editing message " + err.toString()));
		return;
	}
	logger.debug("found build version " + jenkinsVersion);
	if (jenkinsVersion <= currentVersion) {
		statusMsg.edit("latest build (#" + jenkinsVersion + ") is not newer than current version (#" + currentVersion + "). stopping update").catch(err => logger.error("issue while editing message " + err.toString()));
		return;
	}
	logger.debug("newer build found, starting download");
	embed.addField("New Build", "#" + jenkinsVersion + ", starting Download...");
	statusMsg.edit(embed).catch(err => logger.error("issue while editing message " + err.toString()));

	const artifact: any = data.artifacts[1];
	const urlFile: string = "/artifact/" + artifact["relativePath"];
	logger.debug("fileURL: " + urlBase + urlFile);

	const newBuildPath: string = "../../minecraft/serverManager/createTest/newBuild/";
	const file: WriteStream = fs.createWriteStream(newBuildPath + artifact["fileName"]);

	let failed: boolean = true;
	await new Promise((resolve, reject) => {
		request(urlBase + urlFile)
			.pipe(file)
			.on('finish', () => {
				logger.debug("new build jar downloaded");
				failed = false;
				resolve();
			})
			.on('error', (error) => {
				reject(error);
			});
	}).catch(error => {
		logger.error("issue while downloading new build jar" + error);
		statusMsg.edit("error while downloading build jar");
		fs.unlinkSync(newBuildPath + artifact["fileName"]);
		failed = true;
	});

	logger.debug("failed check coming up");

	if (failed) return;

	logger.debug("got past failed check");

	fs.writeFileSync(newBuildPath + "build.json", JSON.stringify({
		version: jenkinsVersion,
		fileName: artifact["fileName"]
	}, null, 4));

	logger.debug("wrote new build.json");

	embed.fields[1].value = "#" + jenkinsVersion + ", Download complete";
	embed.addField("Almost Done", "Waiting for server manager to respond ..");
	statusMsg.edit(embed).catch(err => logger.error("issue while editing message " + err.toString()));

	logger.debug("waiting for server manager process");


	serverEvents.once("updateResult", (data) => {
		if (data.result == true) {
			embed.fields[2].value = "Update complete, waiting for server to start ..";
		} else {
			embed.fields[2].name = "Failed";
			embed.fields[2].value = "Update failed :(  Server should be starting with old build";
		}
		statusMsg.edit(embed);
	});

	let firstStop = true;

	const stateChange = (data): void => {
		if (data.status == "starting") return;

		if (data.status == "running") embed.addField("YEP", "Server started successfully");

		if (data.status == "stopped") {
			if (firstStop) {
				firstStop = false;
				return;
			}

			embed.addField("NOP", "Server was unable to start, check the latest crash with !crash or view the current logs with {soonTM}");
		}

		statusMsg.edit(embed);

		serverEvents.removeListener("stateChanged", stateChange);
	};
	serverEvents.on("stateChanged", stateChange);

	ipc.of.createManager.emit("updateServer");

	logger.info("update complete");
})

client.on("message", (msg: Message | PartialMessage) => {
	if (msg.author.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	if (!msg.content.startsWith("!serverStatus")) return;

	ipc.of.createManager.emit("getInfo");

	msg.channel.send("check the pinned messages :)").catch(err => logger.error("issue while sending message during status command " + err.toString()));
})

client.on("message", (msg: Message | PartialMessage) => {
	if (msg.author.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	if (!msg.content.startsWith("!stopServer")) return;

	ipc.of.createManager.emit("stopServer");

	msg.reply("sent!").catch(err => logger.error("issue while replying to stop command " + err.toString()));
})

client.on("message", (msg: Message | PartialMessage) => {
	if (msg.author.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	if (!msg.content.startsWith("!restartServer")) return;

	ipc.of.createManager.emit("restartServer");

	msg.reply("sent!").catch(err => logger.error("issue while replying to restart command " + err.toString()));
})

client.on("message", (msg: Message | PartialMessage) => {
	if (msg.author.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	if (!msg.content.startsWith("!crash")) return;

	serverEvents.once("crashReply", (data) => {
		msg.channel.send("date: " + data.mtime, {
			files: [{
				attachment: "../../minecraft/createTest/crash-reports/"+data.name,
				name: data.name
			}]
		}).catch(err => logger.error("issue while sending reply" + err));
	});
	ipc.of.createManager.emit("getCrash");
})

function doRequest(url): Promise<any> {
	return new Promise(function (resolve, reject) {
		request(url, function (error, res, body) {
			if (!error && res.statusCode == 200) {
				resolve(body);
			} else {
				reject(error);
			}
		});
	});
}

function getColorForStatus(status: string) :ColorResolvable {
	if (status == "stopped") return "DARK_VIVID_PINK";
	if (status == "starting") return "DARK_GOLD";
	if (status == "running") return "DARK_GREEN";
	return "WHITE"
}