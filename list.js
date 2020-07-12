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
var client_1 = require("./client");
var logger_1 = require("./logger");
var util = require("./util");
var config = require("./config.json");
var discord_js_1 = require("discord.js");
var validCommandChannels = config.validCommandChannels;
//command for listing submissions
client_1.client.on("message", function (message) { return __awaiter(void 0, void 0, void 0, function () {
    var type, files, match, thisMessage, embed;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (message.author.bot)
                    return [2 /*return*/];
                if (!util.sentFromValidChannel(message, validCommandChannels))
                    return [2 /*return*/];
                if (message.content.startsWith("!suggestions"))
                    type = "suggestion";
                if (message.content.startsWith("!bugs"))
                    type = "bug";
                if (!type)
                    return [2 /*return*/];
                files = readAllFiles(type);
                if (!files)
                    return [2 /*return*/];
                match = message.content.match(/dump( \d+)?( \d+)?/);
                if (match) {
                    logger_1.logger.info("matched dump request: " + match);
                    replyDump(files, message, type, match);
                    return [2 /*return*/];
                }
                return [4 /*yield*/, message.channel.send("found a total of " + files.length + " submissions for type " + type)];
            case 1:
                thisMessage = _a.sent();
                if (!(files.length < 1)) return [3 /*break*/, 3];
                return [4 /*yield*/, thisMessage.edit(thisMessage.content + "\nnice :)")];
            case 2:
                _a.sent();
                return [2 /*return*/];
            case 3: return [4 /*yield*/, thisMessage.edit(thisMessage.content + "\nbuilding embed, pls wait. \nif this message doesn't disappear after a few seconds, something went wrong. pls ping me")];
            case 4:
                _a.sent();
                embed = buildEmbedWithFiles(files, type, 0);
                //logger.debug(embed);
                return [4 /*yield*/, thisMessage.edit("0", embed)];
            case 5:
                //logger.debug(embed);
                _a.sent();
                thisMessage.react("⏪").then(function () { return thisMessage.react("⏩"); })["catch"](function () { return logger_1.logger.error("issue while adding reactions :("); });
                waitForReaction(thisMessage, type);
                _a.label = 6;
            case 6: return [2 /*return*/];
        }
    });
}); });
function waitForReaction(msg, type) {
    var _this = this;
    var filter = function (reaction, user) {
        return ["⏪", "⏩"].includes(reaction.emoji.name) && !user.bot;
    };
    msg.awaitReactions(filter, { max: 1, time: 600000, errors: ["time"] }) //10 minute timeout
        .then(function (collected) { return __awaiter(_this, void 0, void 0, function () {
        var reaction, indexModify, files, newIndex, embed;
        return __generator(this, function (_a) {
            reaction = collected.first();
            indexModify = 0;
            reaction.users.remove(reaction.users.cache.last().id)["catch"](function (err) { return logger_1.logger.error("issue while removing reaction from list message" + err.toString()); });
            if (reaction.emoji.name === "⏪")
                indexModify -= 1;
            if (reaction.emoji.name === "⏩")
                indexModify += 1;
            files = readAllFiles(type);
            newIndex = Number(msg.content) + indexModify;
            if (newIndex < 0)
                newIndex = 0;
            embed = buildEmbedWithFiles(files, type, newIndex);
            msg.edit(newIndex, embed)["catch"](function (err) { return logger_1.logger.error("issue while editing list message" + err.toString()); });
            waitForReaction(msg, type);
            return [2 /*return*/];
        });
    }); })["catch"](function (_collected) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, msg.reactions.removeAll()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, msg.edit("10 minute timeout passed. type the command again if needed")];
                case 2:
                    _a.sent();
                    logger_1.logger.info("reaction timeout, reactions cleared");
                    return [2 /*return*/];
            }
        });
    }); });
}
function buildEmbedWithFiles(files, type, page) {
    logger_1.logger.debug("begin embed build page " + page);
    var color = (type === "suggestion") ? 6724095 : 11342935;
    var embed = new discord_js_1.MessageEmbed()
        .setColor(color)
        .setFooter("Page " + (page + 1) + " - Entries " + (page * 10 + 1) + " to " + (page * 10 + 10) + " of " + files.length);
    var initIndex, maxIndex;
    if (files.length >= (page + 1) * 10) {
        //use 10 files
        initIndex = page * 10;
        maxIndex = initIndex + 9;
    }
    else if (files.length > page * 10) {
        //use 1-9 files
        initIndex = page * 10;
        maxIndex = files.length - 1;
    }
    else {
        //page number to high
        embed.setDescription("page empty ;_;");
        return embed;
    }
    logger_1.logger.debug("initIndex " + initIndex + "    maxIndex" + maxIndex);
    //logger.debug("files  ", files);
    for (var i = initIndex; i <= maxIndex; i++) {
        //var currFile = require("./data/" + type + "s/" + files[i]);
        var currFile = JSON.parse(fs.readFileSync("./data/" + type + "s/" + files[i], "utf-8"));
        embed.addField("Entry " + (i + 1) + " from " + currFile.author, "[link](" + currFile.link + ") " + currFile.msg.substring(0, 850));
    }
    logger_1.logger.info("embed build successful");
    return embed;
}
function replyDump(files, msg, type, match) {
    logger_1.logger.debug("starting dump reply");
    var indexStart = 0;
    var indexEnd = files.length - 1;
    if (match[1]) {
        var startMatch = Number(match[1]);
        if (startMatch >= indexStart && startMatch <= indexEnd)
            indexStart = startMatch;
    }
    if (match[2]) {
        var endMatch = Number(match[2]);
        if (endMatch >= indexStart && endMatch <= indexEnd)
            indexEnd = endMatch;
    }
    var reply = "";
    for (var i = indexStart; i <= indexEnd; i++) {
        //const currFile = require("./data/" + type + "s/" + files[i]);
        var currFile = JSON.parse(fs.readFileSync("./data/" + type + "s/" + files[i], "utf-8"));
        reply = reply.concat(files[i], ": ", currFile.link, " entry ", (i + 1).toString(), " from ", currFile.author, ": ", currFile.msg.substring(0, 500), "\n");
    }
    fs.writeFileSync("./data/dump.txt", reply);
    logger_1.logger.debug("written dump data to file");
    msg.channel.send("yo have fun with this :)", {
        files: [{
                attachment: "./data/dump.txt",
                name: "dump.txt"
            }]
    })["catch"](function (err) { return logger_1.logger.error("issue while sending reply" + err.toString()); });
    logger_1.logger.info("finished dump reply");
}
function readAllFiles(subDirectory) {
    return fs.readdirSync("./data/" + subDirectory + "s/");
}
