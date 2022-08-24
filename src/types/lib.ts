export type BuildInfo = {
	version: number;
	fileName: string;
}

export type DatedFile = {
	file: string;
	name: string;
	mtime?: Date
}

export type ServerStatus = "starting" | "stopped" | "running" | "errored";

export type UpdatePrep = "requestFailed" | "versionNotNew" | "downloadFailed" | "success";

export type UpdateEntry = {
	name: string;
	url: string;
	fileRegex: string;
	targetDir: string;
}

export type UpdatePrepResult = {
	name: string;
	status: "requestFailed" | "versionCheckFailed" |  "versionNotNew" | "downloadFailed" | "success";
	version?: number;
	fileName?: string;
}