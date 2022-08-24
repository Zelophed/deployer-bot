import * as fs from "fs";

export const config: {
	token: string,
	roleSuggestionId: string,
	roleBugId: string,
	validSubmissionChannels: string[],
	validCommandChannels: string[],
	rolesThatCanRemoveSubmissions: string[],
	roleAssign: {
		messageID: string,
		channelID: string,
		roles: {
			emoji: string,
			roleID: string
		}[]
	}[]
} = JSON.parse(fs.readFileSync("./config.json", "utf8"));

if (!config.token) throw new Error("config parsing went wrong!");
