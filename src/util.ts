import type {Message, PartialMessage, Snowflake} from "discord.js";
import {client} from "./client";
import {logger} from "./logger";
import {MessageEmbed, MessageOptions, TextChannel} from "discord.js";
import {MessageChannel} from "./types/ipcResponseTypes";

export function sentFromValidChannel(message: Message | PartialMessage, validChannels: Array<string>) {
	return validChannels.includes(message.channel?.id ?? "nope");
}

export function messageZelo(message: string | (MessageOptions & { split?: false | undefined; })) {
	const zelo = client.users.cache.get("132983959272292353");
	if (!zelo) return;

	zelo.send(message).catch(err => logger.error("unable to send dm " + err));
}

export function sendMessageToChannel(data: MessageChannel): void {
	const id: Snowflake = <Snowflake>data.channelID ?? "692400012650610688"; //bot-spam
	client.channels.fetch(id)
			.then((channel: TextChannel) => {
				if (data.embed === true)
					return channel.send({
						embeds: [ new MessageEmbed().setDescription(data.message) ]
					})
				else
					return channel.send(data.message);
			})
			.catch((err: any) => logger.error(err));
}

export function capitalizeFirstLetter(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

export class Node {

	static readonly nodes = [
		new Node(
				"A",
				"nodeA",
				"1.16 SMP",
				8271,
				"859946522874216468",//#smp-spam
				"859959843762995231"),

		new Node(
				"B",
				"nodeB",
				"1.18 DEV",
				8272,
				"692400012650610688",//#bot-spam
				"730519740463710440")

		/*new Node(
			"nodeC",
			"1.16 SMP",
			"C")*/
	]

	static readonly nodeA = Node.nodes[0];
	static readonly nodeB = Node.nodes[1];
	//static readonly nodeC = Node.nodes[2];

	private constructor(
			readonly id: string,
			readonly name: string,
			readonly label: string,
			readonly port: number,
			readonly channelID: Snowflake,
			readonly messageID: Snowflake
	) {}

	static byID = (id: string) => {
		return Node.nodes.find(value => value.id.toLowerCase() == id.toLowerCase())
	}


}
