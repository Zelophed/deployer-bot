import {ServerStatus, UpdatePrepResult} from "./lib";

export type CompositeServerStatus = {
	status: ServerStatus;
	build?: number;
	buildUrl?: string;
}

export type MessageChannel = {
	channelID?: string;
	count?: number;
	message: string;
	embed?: boolean
}

type UpdateStatus = "running" | "complete" | "failed";

export type UpdateInfo = {
	status: UpdateStatus;
	info: string;
	prep?: Array<UpdatePrepResult>;
}
