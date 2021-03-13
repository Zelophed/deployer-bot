import type {Message, PartialMessage} from "discord.js";

export function sentFromValidChannel(message: Message | PartialMessage, validChannels: Array<string>) {
	return validChannels.includes(message.channel?.id ?? "nope");
}

export class Node {

	static readonly nodes = [
		new Node(
			"nodeA",
			"1.15 Dev",
			"A"),

		new Node(
			"nodeB",
			"1.16 Dev",
			"B"),

		new Node(
			"nodeC",
			"1.16 SMP",
			"C")
	]

	static readonly nodeA = Node.nodes[0];
	static readonly nodeB = Node.nodes[1];
	static readonly nodeC = Node.nodes[2];

	private constructor(
		readonly name: string,
		readonly label: string,
		readonly alias: string
	) {}
}
