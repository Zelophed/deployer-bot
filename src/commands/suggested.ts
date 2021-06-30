
import {logger} from "../logger";
import {BaseCommand} from "./_base";
import {ApplicationCommandData, Client, CommandInteraction, MessageEmbed} from "discord.js";

class Suggested implements BaseCommand {
	data: ApplicationCommandData = {
		name: "suggested",
		description: "Share the link to the suggestions spreadsheet",
		defaultPermission: true
	};

	execute = async (client: Client, interaction: CommandInteraction) => {
		let embed: MessageEmbed = new MessageEmbed()
				.setDescription("Great minds think alike! Please make sure to Ctrl+F on [this spreadsheet](https://docs.google.com/spreadsheets/d/1pwX1ZlIIVeLoPXmjNl3amU4iPKpEcbl4FWkOzmYZG5w) to check whether your idea has been suggested before. Thank you!")
				.setColor(6724095);

		interaction.reply({
			embeds: [ embed ]
		}).catch(err => logger.error("issue while sending /suggested reply", err));
	};
}

export {Suggested as command};