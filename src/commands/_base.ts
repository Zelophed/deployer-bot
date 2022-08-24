import {ApplicationCommandData, ApplicationCommandPermissionData, CacheType, Client, CommandInteraction, CommandInteractionOptionResolver} from "discord.js";

export interface BaseCommand {
	execute: (client: Client, interaction: CommandInteraction) => void;
	data: ApplicationCommandData;
	permissions?: ApplicationCommandPermissionData[];
}

export type Options = Omit<CommandInteractionOptionResolver, 'getMessage' | 'getFocused'>

/*
Common permissions:

 allow team role
{
	id: "637994295118397458",
	type: "ROLE",
	permission: true
}

 allow moderator role
{
	id: "815290669504659457",
	type: "ROLE",
	permission: true
}

 allow collaborator role
{
	id: "701915794656854036",
	type: "ROLE",
	permission: true
}

 allow wizard role
 {
	id: "732703439007776899",
	type: "ROLE",
	permission: true
}

 allow Zelophed
{
	id: "132983959272292353",
	type: "USER",
	permission: true
}

 */

/*

empty command template

import {logger} from "../logger";
import {BaseCommand} from "./_base";
import {ApplicationCommandData, ApplicationCommandPermissionData, Client, CommandInteraction} from "discord.js";

class Suggested implements BaseCommand {
	data: ApplicationCommandData = {
		name: "",
		description: "",
		defaultPermission: false,
		options: [

		]
	};

	permissions: ApplicationCommandPermissionData[] = [

	];

	execute = async (client: Client, interaction: CommandInteraction) => {
		logger.debug("command called " + this.data.name);
	}
}

export {Suggested as command};

 */