import log4js = require("log4js");
import * as fs from "fs";

log4js.configure({
	appenders: {
		debugTxt: { type: "file", filename: "logs/debug.txt", maxLogSize: 10485760, compress: true},
		infoTxt: { type: "file", filename: "logs/info.txt", maxLogSize: 10485760, compress: true},
		infoFilter: { type : "logLevelFilter", appender: "infoTxt", level: "info"},
		console: { type: "console" }
	},
	categories: { default: { appenders: ["debugTxt", "infoFilter", "console"], level: "debug" } }
});

const dir = "./logs";
if (!fs.existsSync(dir)) {
	fs.mkdirSync(dir);
}

export const logger = log4js.getLogger();
