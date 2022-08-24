
import express from "express";
import morganLogger from "morgan";
import {Server} from "http";
import {Node, sendMessageToChannel} from "./util";
import {updateStatusMessage} from "./server";
import {ServerStatus} from "./types/lib";


const port = Number(process.env.PORT) || 8270;
const app = express();
let server: Server | null = null;

app.use(morganLogger("dev"));
app.use(express.json());

app.get("/", (req, res) => {
	res.status(200).send("running deployer-bot");
});

app.post("/message/", (req, res) => {
	if (req.body.message === undefined) {
		res.status(400).send("missing message");
		return;
	}

	if (req.body.channel === undefined) {
		res.status(400).send("missing channel");
		return;
	}

	if (req.body.embed === undefined || req.body.embed !== true) {
		req.body.embed = false;
	}

	sendMessageToChannel({
		message: req.body.message,
		channelID: req.body.channel,
		embed: req.body.embed as boolean
	});

	res.status(200).send("OK");
});

//chassis related
app.post("/server/:id/", (req, res) => {
	const id = req.params.id;

	if (id == undefined) {
		res.status(404).send("unknown node: ");
		return;
	}

	const node = Node.byID(id.toString());

	if (node === undefined) {
		res.status(404).send("unknown node: " + id.toString());
		return;
	}

	if (req.body.state === undefined) {
		res.status(400).send("missing state");
		return;
	}

	if (!["starting", "stopped", "running", "errored"].includes(req.body.state)){
		res.status(400).send("invalid state");
		return;
	}

	updateStatusMessage(req.body.state as ServerStatus, node);

	res.status(200).send("OK " + req.body.state);
});

export function startHttp() {
	server = app.listen(port, "localhost");
}

export async function stopHttp() {
	return new Promise<void>((resolve, reject) => {
		if (server !== null)
			server.close(() => resolve());
		else
			reject();
	});
}