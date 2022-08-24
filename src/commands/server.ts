
import {logger} from "../logger";
import {BaseCommand, Options} from "./_base";
import * as Discord from "discord.js";
import {ApplicationCommandChoicesData, ApplicationCommandData, ApplicationCommandPermissionData, Client, CommandInteraction} from "discord.js";
import {capitalizeFirstLetter, Node} from "../util";
import {getColorForStatus, performingUpdate, serverEvents, setUpdatingStatus, updateStatusMessage} from "../server";
import {CompositeServerStatus, UpdateInfo} from "../types/ipcResponseTypes";
import {DatedFile, ServerStatus} from "../types/lib";
import fetch from "node-fetch";

const nodeOption: ApplicationCommandChoicesData = {
	type: "STRING",
	name: "node",
	description: "The server node that should be operated on, can sometimes be inferred from you channel",
	choices: [
		{
			name: "NodeA (SMP)",
			value: "a"
		},
		{
			name: "NodeB (DEV)",
			value: "b"
		}
	]
};

class Server implements BaseCommand {
	data: ApplicationCommandData = {
		name: "server",
		description: "Manage the dev servers",
		defaultPermission: false,
		options: [
			{
				"type": 1,
				"name": "update",
				"description": "Look for new mod versions as specified by the config file",
				"options": [
					nodeOption
				]
			},
			{
				"type": 1,
				"name": "stop",
				"description": "Stop a node and disable its auto-restart",
				"options": [
					nodeOption
				]
			},
			{
				"type": 1,
				"name": "restart",
				"description": "Start or Restart a node and enable its auto-restart",
				"options": [
					nodeOption
				]
			},
			{
				"type": 1,
				"name": "status",
				"description": "Manually fetch a servers status",
				"options": [
					nodeOption
				]
			},
			{
				"type": 1,
				"name": "whitelist",
				"description": "Add a user to the servers whitelist",
				"options": [
					{
						"type": 3,
						"name": "username",
						"description": "The ingame username to add to the whitelist",
						"required": true
					},
					nodeOption
				]
			},
			{
				"type": 1,
				"name": "crash",
				"description": "Retrieve a servers latest crash log",
				"options": [
					nodeOption
				]
			}
		]
	};

	permissions: ApplicationCommandPermissionData[] = [
		{
			id: "637994295118397458",
			type: "ROLE",
			permission: true
		},
		{
			id: "815290669504659457",
			type: "ROLE",
			permission: true
		},
		{
			id: "701915794656854036",
			type: "ROLE",
			permission: true
		},
		{
			id: "732703439007776899",
			type: "ROLE",
			permission: true
		}
	];

	execute = async (client: Client, interaction: CommandInteraction) => {
		let action = interaction.options.getSubcommand(true);

		//determine node
		let node: Node;
		if (interaction.options.getString("node") !== null) {
			const nodeName = interaction.options.getString("node");
			if (nodeName === "a") {
				node = Node.nodeA;
			} else if (nodeName === "b") {
				node = Node.nodeB;
			} else {
				logger.debug("unknown node in server command " + nodeName);
				return;
			}
		} else if (interaction.channelId === Node.nodeB.channelID) {
			node = Node.nodeB;
		} else if (interaction.channelId === Node.nodeA.channelID) {
			node = Node.nodeA;
		} else {
			logger.info("server command used in unknown channel without node argument");
			let embed = new Discord.MessageEmbed()
					.setDescription("Please use this command in one of the server channels or specify a node argument");
			await interaction.reply({
				embeds: [ embed ]
			});

			return;
		}

		logger.debug("server command, action: ", action);
		logger.debug("node: ", node.name);
		logger.debug("options: ", JSON.stringify(interaction.options));

		//switch to action method
		if (action === "update") {
			await update(client, interaction, node, interaction.options);
		}

		if (action === "status") {
			await status(client, interaction, node, interaction.options);
		}

		if (action === "whitelist") {
			await whitelist(client, interaction, node, interaction.options);
		}

		if (action === "restart") {
			await restartAction(client, interaction, node, interaction.options);
		}

		if (action === "stop") {
			await stopAction(client, interaction, node, interaction.options);
		}

		if (action === "crash") {
			await crash(client, interaction, node, interaction.options);
		}

		logger.debug("command called " + this.data.name);
	}
}

async function update(client: Client, interaction: CommandInteraction, node: Node, options: Options) {
	if (performingUpdate) {
		await interaction.reply("Already performing an update, please wait!");
		return;
	}

	let embed = new Discord.MessageEmbed()
			.setDescription("Preparing for update on " + node.name);

	//wip todo
	//embed = new Discord.MessageEmbed()
	//		.setDescription("Sorry, currently not available")
	//		.setColor("ORANGE");

	await interaction.reply({
		embeds: [ embed ]
	});

	let mods = await fetch("http://localhost:" + node.port + "/mods?updates=true")
			.then(res => res.json())
			.catch(async err => {
				await defaultErrorMessages(err, node, interaction)
			}) as any[];

	logger.debug("mods", JSON.stringify(mods));

	if (!mods || mods.length === 0) {
		embed.setDescription("Something went wrong, sorry! Please check the logs");
		await interaction.editReply({
			embeds: [ embed ]
		});
		return;
	}

	let modList: string[] = [];
	let feedback = "";
	mods.forEach(entry => {
		feedback = feedback.concat(entry.name, ": ");
		if (entry.hasUpdate === true) {
			feedback = feedback.concat(entry.version, " >>> ", entry.updatedVersion);
			modList.push(entry.name);
		} else if (typeof entry.updatedVersion === "number") {
			feedback = feedback.concat("Up to date (", entry.version, " > ", entry.updatedVersion, ")");
		} else {
			feedback = feedback.concat("Issue: ", entry.updatedVersion);
		}
		feedback = feedback.concat("\n")
	});

	if (modList.length === 0) {
		embed.addField("No updatable mods found", feedback)
		await interaction.editReply({
			embeds: [ embed ]
		});
		return;
	}

	embed.addField("Updating the following mods", feedback)
	await interaction.editReply({
		embeds: [ embed ]
	});

	let result = await fetch("http://localhost:" + node.port + "/update/", {
		method: "POST",
		body: JSON.stringify({ mods: modList }),
		headers: {
			"Content-Type": "application/json"
		}
	}).catch(err => logger.error(err));

	if (!result) {
		embed.addField("Aborted", "Unknown Failure");
		await interaction.editReply({
			embeds: [ embed ]
		});
		return;
	}

	if (result.status === 409) {
		embed.addField("Aborted", "This node is already updating, please wait!")
				.setColor("DARK_GOLD");
		await interaction.editReply({
			embeds: [ embed ]
		});
		return;
	}

	if (!result.ok) {
		embed.addField("Aborted", "Unknown Failure");
		await interaction.editReply({
			embeds: [ embed ]
		});
		return;
	}

	let updateResults = (await result.json()) as any[];

	feedback = "";
	updateResults.forEach(entry => {
		if (entry.result.success) return;

		logger.debug("issue during update: ", JSON.stringify(entry));
		feedback = feedback.concat(entry.config.name, ": ", entry.result.version);
	});

	if (feedback !== "") {
		embed.addField("Encountered the following issues during update", feedback);
	}

	embed.addField("Almost Done", "Waiting for the server to start .. this message won't update anymore, check the pinned status please!")

	await interaction.editReply({
		embeds: [ embed ]
	});

	/*return;
	setUpdatingStatus(true);



	//setup callbacks
	serverEvents.removeAllListeners("updateInfo");
	serverEvents.once("updateInfo", async (data: UpdateInfo) => {
		if (data.status === "failed") {//Abort before shutdown
			clearTimeout(errorTimeout);
			setUpdatingStatus(false);
			//node is already updating
			if (data.info === "alreadyUpdating") {
				embed.addField("Aborted", "This node is already updating, please wait!")
						.setColor("DARK_GOLD");
				await interaction.editReply({
					embeds: [ embed ]
				});
				return;
			}

			//no mod succeeded
			if (data.info === "prep") {
				let allUpToDate = true;
				let mods = "";
				data.prep?.forEach((value: any) => {
					mods = mods.concat(value.name, ": ");
					if (value.status === "versionNotNew") {
						mods = mods.concat("Up to date.");
					} else {
						mods = mods.concat("Issue: ", value.status);
						allUpToDate = false;
					}
					mods = mods.concat("\n");
				});
				let header = "Aborted" + (allUpToDate ? ", no new versions found" : "");
				embed.addField(header, mods)
						.setColor(allUpToDate ? "DARK_GREEN" : "RED");
				await interaction.editReply({
					embeds: [embed]
				});
				return;
			}

			//??
			embed.addField("Aborted", "Unknown Failure");
			await interaction.editReply({
				embeds: [embed]
			});
			return;
		}

		//status should be running
		logger.debug("Status check:  running-", data.status);

		//got at least one new version, run update
		let mods = "";
		data.prep?.forEach((value: any) => {
			mods = mods.concat(value.name, ": ");
			if (value.status === "success") {
				mods = mods.concat("Updating to build #" + value.version);
			} else if (value.status === "versionNotNew") {
				mods = mods.concat("Up to date.");
			} else {
				mods = mods.concat("Issue: ", value.status);
			}
			mods = mods.concat("\n");
		});

		embed.addField("Prepared. Updating the following mods:", mods)
				.setColor("DARK_GREEN");
		await interaction.editReply({
			embeds: [embed]
		});
		errorTimeout.refresh();

		//setup next callback
		serverEvents.once("updateInfo", async (data: UpdateInfo) => {
			logger.debug("2nd UpdateInfo", data.status);
			if (data.status === "failed") {
				clearTimeout(errorTimeout);
				setUpdatingStatus(false);
				embed.addField("Failed", "Something went wrong :/")
						.setColor("RED");
				await interaction.editReply({
					embeds: [ embed ]
				});
				return;
			}

			if (data.status === "running") {
				clearTimeout(errorTimeout);
				setUpdatingStatus(false);
				embed.addField("Unexpected Callback", "Something went wrong: " + data.info)
						.setColor("RED");
				await interaction.editReply({
					embeds: [ embed ]
				});
				return;
			}

			clearTimeout(errorTimeout);
			embed.addField("Almost Done", "Waiting for Server to start ..");
			await interaction.editReply({
				embeds: [ embed ]
			});

			//wait for server start
			let firstStop = true;

			const stateChange = async (data: CompositeServerStatus) => {
				if (data.status == "starting") return;

				if (data.status == "running") {
					embed.addField("YEP", "Server started successfully");
				}

				if (data.status == "stopped") {
					if (firstStop) {
						firstStop = false;
						return;
					}

					embed.addField("NOPE", "Server was unable to start");
				}

				await interaction.editReply({
					embeds: [ embed ]
				});

				setUpdatingStatus(false);
				serverEvents.removeListener("stateChanged", stateChange);
			};
			serverEvents.on("stateChanged", stateChange);

			logger.info("Update complete, waiting for server");
		});

	});*/
}

async function status(client: Client, interaction: CommandInteraction, node: Node, options: Options) {
	await interaction.deferReply();

	let statusResponse: any = await fetch("http://localhost:" + node.port + "/status/")
			.then(res => res.json())
			.catch(async err => {
				await defaultErrorMessages(err, node, interaction)
			});

	if (!statusResponse) return;

	let modsResponse = await fetch("http://localhost:" + node.port + "/mods/")
			.then(res => res.json())
			.catch(async err => {
				logger.warn("issue with mods request during status command: ", err);
			}) as any[];

	let state: ServerStatus = statusResponse.status;
	updateStatusMessage(state, node);

	let embed = new Discord.MessageEmbed()
			.setDescription("Pinned message in the server's associated channel should be up to date now.")
			.setColor(getColorForStatus(state))
			.addField(node.name, node.label)
			.addField("Status", capitalizeFirstLetter(state))
			.addField("Restarts since last interaction", "" + statusResponse.errors)

	if (modsResponse) {
		try {
			let feedback = "";
			modsResponse.forEach(entry => {
				feedback = feedback.concat(entry.name, ": ", entry.version, "\n");
			});
			embed.addField("Mod Versions: ", feedback);
		} catch (e) {
			logger.debug("issue during mod list conversion: ", modsResponse, e)
		}
	}

	await interaction.editReply({
		embeds: [ embed ]
	});


	/*fetch("http://localhost:" + node.port + "/status/")
			.then(res => res.json())
			.then(async (res: any) => {
				let state: ServerStatus = res.status;
				updateStatusMessage(state, node);

				let embed = new Discord.MessageEmbed()
						.setDescription("Pinned message in the server's associated channel should be up to date now.")
						.setColor(getColorForStatus(state))
						.addField(node.name, node.label)
						.addField("Status", capitalizeFirstLetter(state))
						.addField("Restarts since last interaction", "" + res.errors)

				await interaction.editReply({
					embeds: [ embed ]
				});
			})
			.catch(async err => {
				await defaultErrorMessages(err, node, interaction)
			});*/
}

async function whitelist(client: Client, interaction: CommandInteraction, node: Node, options: Options) {
	const name = options.getString("username");
	if (!name) {
		await interaction.reply("Username argument missing");
		return;
	}

	await interaction.deferReply();

	fetch("http://localhost:" + node.port + "/whitelist/", {
		method: "post",
		body: JSON.stringify({ username: name }),
		headers: {
			"Content-Type": "application/json"
		}
	})
			.then(res => res.json())
			.then(async (res: any) => {
				if (res.serverMissing) {
					await interaction.editReply({
						content: "Server isn't running. If its listed as such, something went wrong :D"
					});
					return;
				}

				if (res.alreadyPresent) {
					await interaction.editReply({
						content: "User " + name + " should already be whitelisted on the Server. Enjoy!"
					});
					return;
				}

				if (!res.success) {
					await interaction.editReply({
						content: "Something went wrong, sorry! Pls check the logs."
					});
					return;
				}

				await interaction.editReply({
					content: "Added user `" + res.username + "` to the whitelist!"
				});
			})
			.catch(async err => {
				await defaultErrorMessages(err, node, interaction);
			});
}

async function restartAction(client: Client, interaction: CommandInteraction, node: Node, options: Options) {
	await interaction.deferReply();

	fetch("http://localhost:" + node.port + "/restart/", {
		method: "post"
	})
			.then(async (res) => {
				await interaction.editReply({
					content: "Server should be starting. Check the pinned status message for updates"
				});
			})
			.catch(async err => {
				await defaultErrorMessages(err, node, interaction);
			});
}

async function stopAction(client: Client, interaction: CommandInteraction, node: Node, options: Options) {
	await interaction.deferReply();

	fetch("http://localhost:" + node.port + "/stop/", {
		method: "post"
	})
			.then(async (res) => {
				if (res.status === 304) {
					await interaction.editReply({
						content: "Server is already stopped!"
					});
					return;
				}
				await interaction.editReply({
					content: "Server should be stopping. Check the pinned status message for updates"
				});
			})
			.catch(async err => {
				await defaultErrorMessages(err, node, interaction);
			});
}

async function crash(client: Client, interaction: CommandInteraction, node: Node, options: Options) {
	await interaction.deferReply();

	fetch("http://localhost:" + node.port + "/crash/meta/")
			.then(res =>  res.json())
			.then(async (data: DatedFile) => {
				const response = await fetch("http://localhost:" + node.port + "/crash/");
				if (response.body === null)
					throw new Error("crash report file was null");

				let content = node.name + " | Date: " + data.mtime;

				if (new Date().getTime() - new Date(data.mtime ?? "0").getTime() > 60 * 60 * 1000)
					content = "File is older than an hour. Are you sure this is what you are looking for?\n" + content;

				await interaction.editReply({
					content: content,
					files: [{
						attachment: response.body,
						name: data.name
					}]
				});
			})
			.catch(async err => {
				await defaultErrorMessages(err, node, interaction);
			});
}

async function defaultErrorMessages(err: any, node: Node, interaction: CommandInteraction) {
	if (err.code === "ECONNREFUSED") {
		logger.warn("node" + node.id + " refused to connect .. err: ", err);
		await interaction.editReply({
			content: "Unable to connect to node, are you sure it's running?"
		});
	} else {
		logger.warn("unknown error while trying to fetch from node" + node.id + " .. err: ", err);
		logger.warn("error.code: ", err.code)
		logger.warn("error.type: ", err.type)
		logger.warn("error.message: ", err.message)
		await interaction.editReply({
			content: "Unknown error occurred, sorry! Pls check the logs"
		});
	}
}

export {Server as command};