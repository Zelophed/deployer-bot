import type {Message, PartialMessage} from "discord.js";

export function sentFromValidChannel(message: Message | PartialMessage, validChannels: Array<string>) {
	return validChannels.includes(message.channel.id);
}
