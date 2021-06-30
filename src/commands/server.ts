
import {logger} from "../logger";
import {BaseCommand} from "./_base";
import * as Discord from "discord.js";
import {ApplicationCommandData, ApplicationCommandOptionData, ApplicationCommandPermissionData, Client, Collection, CommandInteraction, CommandInteractionOption} from "discord.js";
import {Node} from "../util";
import {emit, serverEvents} from "../server";
import {CompositeServerStatus} from "../../../tsCommon/src/ipcResponseTypes";
import {DatedFile} from "../../../tsCommon/src/lib";

const nodeOption: ApplicationCommandOptionData = {
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
					nodeOption,
					{
						"type": 3,
						"name": "username",
						"description": "The ingame username to add to the whitelist",
						"required": true
					}
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
		}
	];

	execute = async (client: Client, interaction: CommandInteraction) => {
		let action = interaction.options.keyArray()[0];

		const options = interaction.options.get(action)?.options;
		if (!options)
			return;

		//determine node
		let node: Node;
		if (options.has("node")) {
			const nodeName = <string>options.get("node")?.value;
			if (nodeName === "a") {
				node = Node.nodeA;
			} else if (nodeName === "b") {
				node = Node.nodeB;
			} else {
				logger.debug("unknown node in server command " + nodeName);
				return;
			}
		} else if (interaction.channelID === "692400012650610688") {//#bot-spam
			node = Node.nodeB;
		} else if (interaction.channelID === "123") {//TODO
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
		logger.debug("options: ", options);

		//switch to action method
		if (action === "update") {
			await update(client, interaction, node, options);
		}

		if (action === "status") {
			await status(client, interaction, node, options);
		}

		if (action === "whitelist") {
			await whitelist(client, interaction, node, options);
		}

		if (action === "restart") {
			await restartAction(client, interaction, node, options);
		}

		if (action === "stop") {
			await stopAction(client, interaction, node, options);
		}

		if (action === "crash") {
			await crash(client, interaction, node, options);
		}

		logger.debug("command called " + this.data.name);
	}
}

async function update(client: Client, interaction: CommandInteraction, node: Node, options: Collection<string, CommandInteractionOption>) {
	await interaction.reply("Currently not implemented. Sorry!");
}

async function status(client: Client, interaction: CommandInteraction, node: Node, options: Collection<string, CommandInteractionOption>) {
	await interaction.defer();

	let errorTimeout = setTimeout(async () => {
		serverEvents.removeAllListeners("infoReply");
		await interaction.editReply({
			content: "Server didn't reply after 30 seconds. Either the process stopped or something else went wrong."
		});
	}, 30000);

	serverEvents.removeAllListeners("infoReply");
	serverEvents.once("infoReply", async (data: CompositeServerStatus) => {
		clearTimeout(errorTimeout);

		await interaction.editReply({
			content: "Check the pinned message in the server's associated channel! It should be up to date now."
		});
	});

	emit(node, "getInfo");
}

async function whitelist(client: Client, interaction: CommandInteraction, node: Node, options: Collection<string, CommandInteractionOption>) {
	const name = options.get("username")?.value;
	if (!name) {
		await interaction.reply("Username argument missing");
		return;
	}

	await interaction.defer();

	let errorTimeout = setTimeout(async () => {
		serverEvents.removeAllListeners("whitelistReply");
		await interaction.editReply({
			content: "Manager didn't reply after 30 seconds. Either the process stopped or something else went wrong."
		});
	}, 30000);

	serverEvents.removeAllListeners("whitelistReply");
	serverEvents.once("whitelistReply", async (data: any) => {
		clearTimeout(errorTimeout);

		if (data.serverMissing) {
			await interaction.editReply({
				content: "Server isn't running. If its listed as such, something went wrong :D"
			});
			return;
		}

		if (!data.success) {
			await interaction.editReply({
				content: "Something went wrong, sorry! Contact a Admin to check the logs."
			});
			return;
		}

		await interaction.editReply({
			content: "Added user `" + data.username + "` to the whitelist!"
		});
	});

	emit(node, "whitelist", { username: name });
}

async function restartAction(client: Client, interaction: CommandInteraction, node: Node, options: Collection<string, CommandInteractionOption>) {
	await interaction.reply({
		content: "Attempting to restart " + node.name + ". Check the pinned message for status updates."
	});

	emit(node, "restartServer");
}

async function stopAction(client: Client, interaction: CommandInteraction, node: Node, options: Collection<string, CommandInteractionOption>) {
	await interaction.reply({
		content: "Attempting to stop " + node.name + ". Check the pinned message for status updates."
	});

	emit(node, "restartServer");
}

async function crash(client: Client, interaction: CommandInteraction, node: Node, options: Collection<string, CommandInteractionOption>) {
	await interaction.defer();

	let errorTimeout = setTimeout(async () => {
		serverEvents.removeAllListeners("crashReply");
		await interaction.editReply({
			content: "Manager didn't reply after 30 seconds. Either the process stopped or something else went wrong."
		});
	}, 30000);

	serverEvents.removeAllListeners("crashReply");
	serverEvents.once("crashReply", (data: DatedFile) => {
		clearTimeout(errorTimeout);

		let s = node.name + " | Date: " + data.mtime;
		interaction.editReply({
			content: s,
			files: [{
				attachment: "../../minecraft/managedServers/" + node?.name + "/crash-reports/" + data.name,
				name: data.name
			}]
		}).catch(err => logger.error("issue while sending reply" + err));
	});
	emit(node, "getCrash");
}

export {Server as command};