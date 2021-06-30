import {logger} from "../logger";
import {BaseCommand} from "./_base";
import {ApplicationCommandData, ApplicationCommandPermissionData, Client, CommandInteraction} from "discord.js";
import * as fs from "fs";

class Submissions implements BaseCommand {
	data: ApplicationCommandData = {
		name: "submissions",
		description: "View suggestions or bugs",
		defaultPermission: false,
		options: [
			{
				"type": "SUB_COMMAND",
				"name": "count",
				"description": "Count the number of submissions",
				"options": [
					{
						"type": "STRING",
						"name": "type",
						"description": "The type of submission",
						"choices": [
							{
								"name": "Suggestion",
								"value": "suggestion"
							},
							{
								"name": "Bug",
								"value": "bug"
							}
						],
						"required": true
					}
				]
			},
			{
				"type": "SUB_COMMAND",
				"name": "dump",
				"description": "Export all stored submissions to a text file",
				"options": [
					{
						"type": "STRING",
						"name": "type",
						"description": "The type of submission",
						"choices": [
							{
								"name": "Suggestion",
								"value": "suggestion"
							},
							{
								"name": "Bug",
								"value": "bug"
							}
						],
						"required": true
					},
					{
						"type": "INTEGER",
						"name": "start",
						"description": "The first submission index to include in the dump"
					},
					{
						"type": "INTEGER",
						"name": "end",
						"description": "The last submission index to include in the dump"
					}
				]
			}
		]
	};

	permissions: ApplicationCommandPermissionData[] = [
		{
			id: "132983959272292353",
			type: "USER",
			permission: true
		},
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

		const type = <"suggestion" | "bug">options.get("type")?.value;

		if (action === "count") {
			await interaction.defer();

			const files = readAllFiles(type);
			if (!files)
				return;

			let messageContent = "Found a total of " + files.length + " submissions for type " + type;
			await interaction.editReply({
				content: messageContent
			});

			return;
		}

		if (action === "dump") {
			await interaction.defer();

			const files = readAllFiles(type);
			if (!files)
				return;

			let startArgument = <number | undefined>options.get("start")?.value;
			let endArgument = <number | undefined>options.get("end")?.value;

			logger.debug("starting dump reply");
			let indexStart: number = 0;
			let indexEnd: number = files.length - 1;
			if (startArgument) {
				if (startArgument >= indexStart && startArgument <= indexEnd)
					indexStart = startArgument;
			}
			if (endArgument) {
				if (endArgument >= indexStart && endArgument <= indexEnd)
					indexEnd = endArgument;
			}

			let data: string = "";
			let count = 0;
			for (let i = indexStart; i <= indexEnd; i++) {
				const currFile: any = JSON.parse(fs.readFileSync("./data/" + type + "s/" + files[i], "utf-8"));
				let currString: string = files[i].split(".")[0];
				currString += " - " + currFile.link + " - entry #" + (i + 1).toString() + " from " + currFile.author + ": ";
				if (currFile.msg.length > 500) {
					currString += currFile.msg.substring(0, 500) + "...";
				} else {
					currString += currFile.msg;
				}
				data = data.concat(currString, "\n");
				count++;
				//data = data.concat(files[i], ": ", currFile.link, " entry ", (i + 1).toString(), " from ", currFile.author, ": ", currFile.msg.substring(0, 500), "\n");
			}

			fs.writeFileSync("./data/dump.txt", data);
			logger.debug("written dump data to file ", count);

			interaction.editReply({
				content: "Dump contains " + count + " submission" + (count === 1 ? "" : "s") + ". Enjoy :)",
				files: [{
					attachment: "./data/dump.txt",
					name: "dump.txt"
				}]
			}).catch(err => logger.error("issue while sending reply" + err.toString()));

			logger.info("finished dump reply");

			return;
		}

		logger.debug("command called " + this.data.name);
		logger.debug(interaction.options);
	}
}

function readAllFiles(subDirectory: "suggestion" | "bug"): string[] {
	return fs.readdirSync("./data/" + subDirectory + "s/");
}

export {Submissions as command};