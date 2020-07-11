const config = require("./config.json");
const fs = require("fs");
const http = require("http");
const ipc = require("node-ipc");
const request = require("request");
const Discord = require("discord.js");

const client = require("./client.js");
const util = require('./util.js');

const logger = require('./logger.js');

const validCommandChannels = config.validCommandChannels;


ipc.config.id = "deployerBotLive";
ipc.config.retry = 10000;

var sendMessageToChannel = function(data) {
    client.channels.fetch("692400012650610688")
        .then(channel => channel.send(data.message))
        .catch(logger.error);
};

//local version of the server status, gets updated every time we get an event from the manager socket
var statusEmbed = new Discord.MessageEmbed()
    .setTitle("Current Server Status")
    .setFooter("Last Update")
    .setTimestamp()
    .addField("Status:", "?")
    .addField("Build:", "?")

var updateTimeout;

function updateStatusMessage(data) {
    logger.debug("updating server status message");
    statusEmbed.fields[0].value = data.status;
    statusEmbed.fields[1].value = data.build;
    statusEmbed.setTimestamp();
    statusEmbed.setColor(getColorForStatus(data.status));

    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
        client.channels.fetch("692400012650610688")
        .then(channel => channel.messages.fetch("730519740463710440")
            .then(message => { 
                //logger.debug("message: " + message.content);
                //logger.debug("embed:" + JSON.stringify(statusEmbed));
                message.edit(statusEmbed)
                    .then(msg => logger.debug("message contents updated"))
                    .catch(err => logger.error("unable to update message;; " + err));
            })
            .catch(err => logger.error("issue while fetching message;; " + err)))
        .catch(err => logger.error("issue while fetching channel;; " + err));
        updateTimeout = null;
    }, 500);
}

var infoReplyCallback = function(data) {};
var updateResultCallback = function(data) {};
var stateChangedCallback = function(data) {};
var crashReplyCallback = function(data) {};

ipc.connectTo('createManager', () => {
    ipc.of.createManager.on('connect', () => {
        //ipc.log('## connected to world ##'.rainbow, ipc.config.delay);
        //ipc.of.createManager.emit(
        //    'message',  //any event or message type your server listens for
        //    'hello'
        //)
        ipc.of.createManager.emit("setDiscordProcess");

        setTimeout(() => ipc.of.createManager.emit("getInfo"), 2500);
    });
    ipc.of.createManager.on('disconnect', () => {
        ipc.log('disconnected from world'.notice);
    });
    ipc.of.createManager.on("infoReply", (data) => {
        logger.info("infoReply: " + data);
        updateStatusMessage(data);

        infoReplyCallback(data);
        infoReplyCallback = (data) => {};
    });
    ipc.of.createManager.on("updateResult", (data) => {
        logger.info("updateComplete");
        updateResultCallback(data);
        updateResultCallback = (data) => {};
    })
    ipc.of.createManager.on("serverStateChanged", (data) => {
    	logger.info("serverStateChanged" + data);
        updateStatusMessage(data);

        stateChangedCallback(data);
    })
    ipc.of.createManager.on("messageChannel", (data) => {
    	logger.info("sending message: " + data.message);
        sendMessageToChannel(data);
    })
    ipc.of.createManager.on("crashReply", (data) => {
        logger.info("crashReply: " + data);
        crashReplyCallback(data);
        crashReplyCallback = (data) => {};
    })
});

//update server command
client.on("message", async msg => {
	if (msg.author.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	if (!msg.content.startsWith("!updateServer")) return;

	var statusMsg;
    var embed = {
        "description": "updating server ...",
        "fields": []
    };
    statusMsg = await msg.channel.send({embed});

    var currentVersion;
    infoReplyCallback = (data) => {
        embed["fields"][0] = {
            "name": "info",
            "value": "serverStatus: " + data.status + "  build version: #" + data.build
        };
        currentVersion = data.build;
        statusMsg.edit({embed});
    };
    ipc.of.createManager.emit("getInfo");

    var urlBase = "http://ci.tterrag.com/job/Create/job/1.15-dev/lastStableBuild";
    logger.debug("performing request to ci base url");
    var res = await doRequest(urlBase+"/api/json");
    logger.debug("request complete");
    var data = JSON.parse(res);
    var jenkinsVersion = data.number;
    if (!jenkinsVersion) {
        statusMsg.edit("error retrieving latest build version from CI");
        return;
    };
    logger.debug("found build version "+jenkinsVersion);
    if (jenkinsVersion <= currentVersion) {
        statusMsg.edit("latest build (#" + jenkinsVersion + ") is not newer than current version (#" + currentVersion + "). stopping update");
        return;
    }
    logger.debug("newer build found, starting download");
    embed["fields"][1] = {
        "name": "new build",
        "value": "#"+jenkinsVersion+", starting download.."
    };
    statusMsg.edit({embed});

    var artifact = data.artifacts[1];
    var urlFile = "/artifact/" + artifact["relativePath"];
    logger.debug("fileURL: " + urlBase + urlFile);

    var newBuildPath = "../../minecraft/serverManager/createTest/newBuild/";
    var file = fs.createWriteStream(newBuildPath + artifact["fileName"]);

    var failed = true;
    await new Promise((resolve, reject) => {
        let stream = request(urlBase + urlFile)
            .pipe(file)
            .on('finish', () => {
                logger.debug("new build jar downloaded");
                failed = false;
                resolve();
            })
            .on('error', (error) => {
                reject(error);
            })
    }).catch(error => {
        logger.error("issue while downloading new build jar");
        statusMsg.edit("error while downloading build jar");
        fs.unlink(newBuildPath + artifact["fileName"]);
        failed = true;
    });

    logger.debug("failed check coming up");

    if (failed) return;

    logger.debug("got past failed check");

    fs.writeFileSync(newBuildPath + "build.json", JSON.stringify({version: jenkinsVersion, fileName: artifact["fileName"]}, null, 4));

    /*fs.writeFile(newBuildPath + "build.json", JSON.stringify({version: jenkinsVersion, fileName: artifact["fileName"]}, null, 4), function (err) {
        if (err) throw err;
        logger.info("saved file");
    });*/

    logger.debug("wrote new build.json");

    embed["fields"][1] = {
        "name": "new build",
        "value": "#"+jenkinsVersion+", download complete"
    };
    embed["fields"][2] = {
        "name": "almost done",
        "value": "waiting for server manager to respond.."
    }
    statusMsg.edit({embed});

    logger.debug("waiting for server manager process");


    updateResultCallback = (data) => {
        if (data.result == true) {
            embed["fields"][2] = {
                "name": "done",
                "value": "update complete, server starting .."
            };
        } else {
            embed["fields"][2] = {
                "name": "failed",
                "value": "update failed :(, server should be starting with old build"
            };
        }
        statusMsg.edit({embed});
    }

    var firstStop = true;

    stateChangedCallback = (data) => {
        if (data.status == "starting") return;

        if (data.status == "running") embed["fields"][3] = {
            "name": "YEP",
            "value": "server started successfully"
        };

        if (data.status == "stopped") {
            if (firstStop) {
                firstStop = false;
                return;
            }

            embed["fields"][3] = {
                "name": "Nope",
                "value": "server was unable to start, check the latest crash log with !crash"
            };
        }

        statusMsg.edit({ embed });

        stateChangedCallback = (data) => {}
    }

    ipc.of.createManager.emit("updateServer");

    logger.info("update complete");
})

client.on("message", async msg => {
	if (msg.author.bot) return;

	if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

	if (!msg.content.startsWith("!serverStatus")) return;

    /*var sentMessage;
    infoReplyCallback = async (data) => {
        embed["fields"][0]["value"] = data.status;
        embed["fields"][1]["value"] = data.build;
        sentMessage = await msg.channel.send("current server status:", { embed });
        sentMessage.pin().catch(err => logger.error("issue while pinnnig message" + err));
    };*/

    /*stateChangedCallback = (data) => {
        embed["fields"][0]["value"] = data;
        if (sentMessage) {
            sentMessage.edit("current server status:", { embed });
        }
    }*/

    ipc.of.createManager.emit("getInfo");

    msg.channel.send("check the pinned messages :)");


})

client.on("message", msg => {
    if (msg.author.bot) return;

    if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

    if (!msg.content.startsWith("!stopServer")) return;

    ipc.of.createManager.emit("stopServer");

    msg.reply("sent!");
})

client.on("message", msg => {
    if (msg.author.bot) return;

    if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

    if (!msg.content.startsWith("!restartServer")) return;

    ipc.of.createManager.emit("restartServer");

    msg.reply("sent!");
})

client.on("message", msg => {
    if (msg.author.bot) return;

    if (!util.sentFromValidChannel(msg, validCommandChannels)) return;

    if (!msg.content.startsWith("!crash")) return;

    crashReplyCallback = (data) => {
        msg.channel.send("date: " + data.mtime, {
            files: [{
                attachment: "../../minecraft/createTest/crash-reports/"+data.name,
                name: data.name
            }]
        }).catch(err => logger.error("issue while sending reply" + err));
    }
    ipc.of.createManager.emit("getCrash");

    //msg.reply("sent!");
})

function doRequest(url) {
  return new Promise(function (resolve, reject) {
    request(url, function (error, res, body) {
      if (!error && res.statusCode == 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
}

function getColorForStatus(status) {
    if (status == "stopped") return "DARK_VIVID_PINK";
    if (status == "starting") return "DARK_GOLD";
    if (status == "running") return "DARK_GREEN";
    return "WHITE"
}