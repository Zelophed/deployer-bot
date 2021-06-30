import {BaseCommand} from "./_base";
import {ApplicationCommandData, ApplicationCommandPermissionData, Client, CommandInteraction, DMChannel, MessageEmbed} from "discord.js";
import {logger} from "../logger";

class Delete implements BaseCommand {
	data: ApplicationCommandData = {
		name: "delete",
		description: "Delete the last x messages in this channel",
		defaultPermission: false,
		options: [{
			name: "amount",
			type: "INTEGER",
			required: true,
			description: "Amount of messages to delete. Must be less than 1000!"
		}]
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
		}
	];

	execute = async (client: Client, interaction: CommandInteraction) => {
		if (interaction.channel instanceof DMChannel) {
			await interaction.reply({
				content: "This can only be used in guild. Sry.",
				ephemeral: true
			})
			return;
		}

		let value = <number>interaction.options.get("amount")?.value;
		if (!value || value < 1 || value > 1000)
			return;

		logger.info("User " + interaction.user.tag + " issued message deletion for " + value + " messages!");
		await interaction.defer({ ephemeral: true });

		let deleted = 0;
		while (value > 0) {
			let toDelete = value > 90 ? 90 : value;
			let del = await interaction.channel.bulkDelete(toDelete);
			value -= toDelete;
			deleted += del.size;
		}

		logger.info("Deleted " + deleted + " messages in channel #" + interaction.channel.name);
		let embed: MessageEmbed = new MessageEmbed()
				.setDescription("🧹 Swept " + deleted + " messages under the rug for you 🧹");

		await interaction.editReply({
			embeds: [ embed ]
		});

	};

}

export {Delete as command};