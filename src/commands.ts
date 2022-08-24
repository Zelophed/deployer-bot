
import {logger} from "./logger";
import {readdirSync} from "fs";
import {client} from "./client";
import {BaseCommand} from "./commands/_base";
import {ApplicationCommandData, Message, PartialMessage} from "discord.js";

export const commandMap = new Map<string, BaseCommand>();

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function load() {
	const cmdFiles = readdirSync(__dirname + "/commands/");
	logger.info("loading " + cmdFiles.length + " files as commands from disk");
	cmdFiles.forEach(async file => {
		if (file.startsWith("_")) {
			logger.info("skipping underscore file");
			return;
		}
		if (!file.endsWith(".js")) {
			logger.info("skipping file '" + file + "' - not a .js file");
			return;
		}

		const cmdName = file.split(".")[0];
		logger.info("loading command file for: " + cmdName);
		const cls = ((await import(__dirname + "/commands/" + file)).command)
		const cmd = new cls();
		commandMap.set(cmdName, cmd);
		logger.debug(cmd.data);
	});
}

//update slash commands
client.on("message", async (msg: Message | PartialMessage) => {
	if (!client.application?.owner) await client.application?.fetch();

	if (msg.content?.toLowerCase() !== "!deployCommands".toLowerCase())
		return;

	if (msg.author?.id !== client.application?.owner?.id)
		return;

	let commandManager = client.guilds.cache.get("620934202875183104")?.commands;

	if (!commandManager) {
		logger.error("unable to access guild command manager")
		return;
	}

	//assemble command data
	let commandData: Array<ApplicationCommandData> = [];
	commandMap.forEach(cmd => {
		commandData.push(cmd.data);
	});

	const commands = await commandManager.set(commandData);
	//logger.info("set commands", commands);

	commands.forEach(cmd => {
		logger.debug("forEach command: ", cmd);
		const storedCmd = commandMap.get(cmd.name);
		if (!commandManager || !storedCmd || !storedCmd.permissions)
			return;

		commandManager.permissions.set({
			command: cmd.id,
			permissions: storedCmd.permissions
		});
		logger.info("set permissions for command " + cmd.name + " to ", storedCmd.permissions);
	});

	msg.reply({
		content: "Deployed commands successfully. Check logs for further info."
	}).catch(err => logger.error("issue while sending deploy feedback", err));
});

//execute commands
client.on("interaction", interaction => {
	if (!interaction.isCommand())
		return;

	const cmdName = interaction.commandName;
	const cmd = commandMap.get(cmdName);
	if (!cmd) {
		logger.debug("skipping unknown command: ", cmdName, interaction);
		return;
	}
	cmd.execute(client, interaction);
	logger.debug("executing command " + cmdName + " for user " + interaction.user.tag);

});

