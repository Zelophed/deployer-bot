"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var fs = require("fs");
var ipc = require("node-ipc");
var request = require("request");
var events = require("events");
var client_1 = require("./client");
var Discord = require("discord.js");
var util = require("./util");
var logger_1 = require("./logger");
var config = require("./config.json");
var validCommandChannels = config.validCommandChannels;
ipc.config.id = "deployerBotLive";
ipc.config.retry = 10000;
var sendMessageToChannel = function (data) {
    client_1.client.channels.fetch("692400012650610688")
        .then(function (channel) { return channel.send(data.message); })["catch"](function (err) { return logger_1.logger.error(err); });
};
//local version of the server status, gets updated every time we get an event from the manager socket
var statusEmbed = new Discord.MessageEmbed()
    .setTitle("Current Server Status")
    .setFooter("Last Update")
    .setTimestamp()
    .addField("Status:", "?")
    .addField("Build:", "?");
var updateTimeout;
function updateStatusMessage(data) {
    logger_1.logger.debug("updating server status message");
    statusEmbed.fields[0].value = data.status;
    statusEmbed.fields[1].value = data.build;
    statusEmbed.setTimestamp();
    statusEmbed.setColor(getColorForStatus(data.status));
    if (updateTimeout)
        clearTimeout(updateTimeout);
    updateTimeout = setTimeout(function () {
        client_1.client.channels.fetch("692400012650610688")
            .then(function (channel) { return channel.messages.fetch("730519740463710440")
            .then(function (message) {
            //logger.debug("message: " + message.content);
            //logger.debug("embed:" + JSON.stringify(statusEmbed));
            message.edit(statusEmbed)
                .then(function () { return logger_1.logger.debug("message contents updated"); })["catch"](function (err) { return logger_1.logger.error("unable to update message;; " + err); });
        })["catch"](function (err) { return logger_1.logger.error("issue while fetching message;; " + err); }); })["catch"](function (err) { return logger_1.logger.error("issue while fetching channel;; " + err); });
        updateTimeout = null;
    }, 500);
}
var serverEvents = new events.EventEmitter();
ipc.connectTo('createManager', function () {
    ipc.of.createManager.on('connect', function () {
        ipc.of.createManager.emit("setDiscordProcess");
        setTimeout(function () { return ipc.of.createManager.emit("getInfo"); }, 2500);
    });
    ipc.of.createManager.on('disconnect', function () {
        logger_1.logger.info("disconnected from server manager");
    });
    ipc.of.createManager.on("infoReply", function (data) {
        logger_1.logger.info("infoReply: " + data);
        updateStatusMessage(data);
        serverEvents.emit("infoReply", data);
    });
    ipc.of.createManager.on("updateResult", function (data) {
        logger_1.logger.info("updateComplete");
        serverEvents.emit("updateResult", data);
    });
    ipc.of.createManager.on("serverStateChanged", function (data) {
        logger_1.logger.info("serverStateChanged" + data);
        updateStatusMessage(data);
        serverEvents.emit("stateChanged", data);
    });
    ipc.of.createManager.on("messageChannel", function (data) {
        logger_1.logger.info("sending message: " + data.message);
        sendMessageToChannel(data);
    });
    ipc.of.createManager.on("crashReply", function (data) {
        logger_1.logger.info("crashReply: " + data);
        serverEvents.emit("crashReply");
    });
});
//update server command
client_1.client.on("message", function (msg) { return __awaiter(void 0, void 0, void 0, function () {
    var statusMsg, embed, currentVersion, urlBase, res, data, jenkinsVersion, artifact, urlFile, newBuildPath, file, failed, firstStop, stateChange;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (msg.author.bot)
                    return [2 /*return*/];
                if (!util.sentFromValidChannel(msg, validCommandChannels))
                    return [2 /*return*/];
                if (!msg.content.startsWith("!updateServer"))
                    return [2 /*return*/];
                embed = new Discord.MessageEmbed()
                    .setDescription("updating server ...");
                return [4 /*yield*/, msg.channel.send({ embed: embed })];
            case 1:
                statusMsg = _a.sent();
                currentVersion = 0;
                return [4 /*yield*/, new Promise(function (resolve) {
                        serverEvents.once("infoReply", function (data) {
                            embed.addField("Server Info", "Status: " + data.status + " | Build: #" + data.build);
                            currentVersion = data.build;
                            statusMsg.edit(embed);
                            resolve();
                        });
                        ipc.of.createManager.emit("getInfo");
                    })];
            case 2:
                _a.sent();
                urlBase = "http://ci.tterrag.com/job/Create/job/1.15-dev/lastStableBuild";
                logger_1.logger.debug("performing request to ci base url");
                return [4 /*yield*/, doRequest(urlBase + "/api/json")];
            case 3:
                res = _a.sent();
                logger_1.logger.debug("request complete");
                data = JSON.parse(res);
                jenkinsVersion = data.number;
                if (!jenkinsVersion) {
                    statusMsg.edit("error retrieving latest build version from CI")["catch"](function (err) { return logger_1.logger.error("issue while editing message " + err.toString()); });
                    return [2 /*return*/];
                }
                logger_1.logger.debug("found build version " + jenkinsVersion);
                if (jenkinsVersion <= currentVersion) {
                    statusMsg.edit("latest build (#" + jenkinsVersion + ") is not newer than current version (#" + currentVersion + "). stopping update")["catch"](function (err) { return logger_1.logger.error("issue while editing message " + err.toString()); });
                    return [2 /*return*/];
                }
                logger_1.logger.debug("newer build found, starting download");
                embed.addField("New Build", "#" + jenkinsVersion + ", starting Download...");
                statusMsg.edit(embed)["catch"](function (err) { return logger_1.logger.error("issue while editing message " + err.toString()); });
                artifact = data.artifacts[1];
                urlFile = "/artifact/" + artifact["relativePath"];
                logger_1.logger.debug("fileURL: " + urlBase + urlFile);
                newBuildPath = "../../minecraft/serverManager/createTest/newBuild/";
                file = fs.createWriteStream(newBuildPath + artifact["fileName"]);
                failed = true;
                return [4 /*yield*/, new Promise(function (resolve, reject) {
                        request(urlBase + urlFile)
                            .pipe(file)
                            .on('finish', function () {
                            logger_1.logger.debug("new build jar downloaded");
                            failed = false;
                            resolve();
                        })
                            .on('error', function (error) {
                            reject(error);
                        });
                    })["catch"](function (error) {
                        logger_1.logger.error("issue while downloading new build jar" + error);
                        statusMsg.edit("error while downloading build jar");
                        fs.unlinkSync(newBuildPath + artifact["fileName"]);
                        failed = true;
                    })];
            case 4:
                _a.sent();
                logger_1.logger.debug("failed check coming up");
                if (failed)
                    return [2 /*return*/];
                logger_1.logger.debug("got past failed check");
                fs.writeFileSync(newBuildPath + "build.json", JSON.stringify({
                    version: jenkinsVersion,
                    fileName: artifact["fileName"]
                }, null, 4));
                logger_1.logger.debug("wrote new build.json");
                embed.fields[1].value = "#" + jenkinsVersion + ", Download complete";
                embed.addField("Almost Done", "Waiting for server manager to respond ..");
                statusMsg.edit(embed)["catch"](function (err) { return logger_1.logger.error("issue while editing message " + err.toString()); });
                logger_1.logger.debug("waiting for server manager process");
                serverEvents.once("updateResult", function (data) {
                    if (data.result == true) {
                        embed.fields[2].value = "Update complete, waiting for server to start ..";
                    }
                    else {
                        embed.fields[2].name = "Failed";
                        embed.fields[2].value = "Update failed :(  Server should be starting with old build";
                    }
                    statusMsg.edit(embed);
                });
                firstStop = true;
                stateChange = function (data) {
                    if (data.status == "starting")
                        return;
                    if (data.status == "running")
                        embed.addField("YEP", "Server started successfully");
                    if (data.status == "stopped") {
                        if (firstStop) {
                            firstStop = false;
                            return;
                        }
                        embed.addField("NOP", "Server was unable to start, check the latest crash with !crash or view the current logs with {soonTM}");
                    }
                    statusMsg.edit(embed);
                    serverEvents.removeListener("stateChanged", stateChange);
                };
                serverEvents.on("stateChanged", stateChange);
                ipc.of.createManager.emit("updateServer");
                logger_1.logger.info("update complete");
                return [2 /*return*/];
        }
    });
}); });
client_1.client.on("message", function (msg) {
    if (msg.author.bot)
        return;
    if (!util.sentFromValidChannel(msg, validCommandChannels))
        return;
    if (!msg.content.startsWith("!serverStatus"))
        return;
    ipc.of.createManager.emit("getInfo");
    msg.channel.send("check the pinned messages :)")["catch"](function (err) { return logger_1.logger.error("issue while sending message during status command " + err.toString()); });
});
client_1.client.on("message", function (msg) {
    if (msg.author.bot)
        return;
    if (!util.sentFromValidChannel(msg, validCommandChannels))
        return;
    if (!msg.content.startsWith("!stopServer"))
        return;
    ipc.of.createManager.emit("stopServer");
    msg.reply("sent!")["catch"](function (err) { return logger_1.logger.error("issue while replying to stop command " + err.toString()); });
});
client_1.client.on("message", function (msg) {
    if (msg.author.bot)
        return;
    if (!util.sentFromValidChannel(msg, validCommandChannels))
        return;
    if (!msg.content.startsWith("!restartServer"))
        return;
    ipc.of.createManager.emit("restartServer");
    msg.reply("sent!")["catch"](function (err) { return logger_1.logger.error("issue while replying to restart command " + err.toString()); });
});
client_1.client.on("message", function (msg) {
    if (msg.author.bot)
        return;
    if (!util.sentFromValidChannel(msg, validCommandChannels))
        return;
    if (!msg.content.startsWith("!crash"))
        return;
    serverEvents.once("crashReply", function (data) {
        msg.channel.send("date: " + data.mtime, {
            files: [{
                    attachment: "../../minecraft/createTest/crash-reports/" + data.name,
                    name: data.name
                }]
        })["catch"](function (err) { return logger_1.logger.error("issue while sending reply" + err); });
    });
    ipc.of.createManager.emit("getCrash");
});
function doRequest(url) {
    return new Promise(function (resolve, reject) {
        request(url, function (error, res, body) {
            if (!error && res.statusCode == 200) {
                resolve(body);
            }
            else {
                reject(error);
            }
        });
    });
}
function getColorForStatus(status) {
    if (status == "stopped")
        return "DARK_VIVID_PINK";
    if (status == "starting")
        return "DARK_GOLD";
    if (status == "running")
        return "DARK_GREEN";
    return "WHITE";
}
