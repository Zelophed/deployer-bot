import type {Message, PartialMessage} from "discord.js";
import {client} from "./client";
import {logger} from "./logger";
import {MessageOptions} from "discord.js";

export function sentFromValidChannel(message: Message | PartialMessage, validChannels: Array<string>) {
	return validChannels.includes(message.channel?.id ?? "nope");
}

export function messageZelo(message: string | (MessageOptions & { split?: false | undefined; })) {
	const zelo = client.users.cache.get("132983959272292353");
	if (!zelo) return;

	zelo.send(message).catch(err => logger.error("unable to send dm " + err));
}

export class Node {

	static readonly nodes = [
		new Node(
			"nodeA",
			"1.16 SMP",
			"A"),

		new Node(
			"nodeB",
			"1.16 DEV",
			"B")

		/*new Node(
			"nodeC",
			"1.16 SMP",
			"C")*/
	]

	static readonly nodeA = Node.nodes[0];
	static readonly nodeB = Node.nodes[1];
	//static readonly nodeC = Node.nodes[2];

	private constructor(
		readonly name: string,
		readonly label: string,
		readonly alias: string
	) {}
}
