import {BaseCommand} from "./_base";
import {ApplicationCommandData, Client, CommandInteraction, MessageEmbed} from "discord.js";
import {getTags, getTagsSync} from "../tag.handler";

const tags = getTagsSync();

class Tag implements BaseCommand {
    data: ApplicationCommandData = {
        name: "tag",
        description: "Send a tag",
        defaultPermission: true,
        options: [{
            name: "name",
            type: "STRING",
            required: true,
            description: "The tag name",
            choices: tags.map((b) => ({ name: b.name, value: b.name }))
        }]
    };

    execute = async (client: Client, interaction: CommandInteraction) => {
        const tags = await getTags();
        const tagName = interaction.options.get('name', true).value as string;

        const tag = tags.find(
            (tag) => tag.name === tagName || tag.aliases?.includes(tagName)
        );

        if (!tag) {
            await interaction.reply({
                content: `Tag \`${tagName}\` does not exist.`,
                ephemeral: true,
            });
            return;
        }

        const embed = new MessageEmbed();
        embed.setTitle(tag.title ?? tag.name);
        embed.setDescription(tag.content);
        if (tag.color) embed.setColor(tag.color);
        if (tag.image) embed.setImage(tag.image);
        if (tag.fields) embed.setFields(tag.fields);

        await interaction.reply({ embeds: [embed] });
    };
}

export {Tag as command};
