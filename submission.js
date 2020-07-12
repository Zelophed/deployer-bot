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
var config = require("./config.json");
var fs = require("fs");
var client_js_1 = require("./client.js");
var logger_js_1 = require("./logger.js");
var util = require("./util.js");
var importFresh = require("import-fresh");
var discord_js_1 = require("discord.js");
var validSubmissionChannels = config.validSubmissionChannels;
var rolesThatCanRemoveSubmissions = config.rolesThatCanRemoveSubmissions;
var roleSuggestionId = config.roleSuggestionId;
var roleBugId = config.roleBugId;
//recognize submission and store to files
client_js_1.client.on('message', function (message) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (message.author.bot)
                    return [2 /*return*/];
                if (message.guild === null)
                    return [2 /*return*/];
                return [4 /*yield*/, validateSubmission(message)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
//delete files when message gests deleted
client_js_1.client.on("messageDelete", function (msg) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        if (!util.sentFromValidChannel(msg, validSubmissionChannels))
            return [2 /*return*/];
        logger_js_1.logger.info("message deleted. " + msg.id + ".json    checking for files");
        scanAndRemoveFile(msg);
        return [2 /*return*/];
    });
}); });
//remove all reaction and delete file if reacted to the X emoji
client_js_1.client.on("messageReactionAdd", function (reaction, user) { return __awaiter(void 0, void 0, void 0, function () {
    var err_1, member, allowedToRemove;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!reaction.partial) return [3 /*break*/, 4];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, reaction.fetch()];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                err_1 = _a.sent();
                logger_js_1.logger.error("error while fetching reaction partial: ", err_1);
                return [2 /*return*/];
            case 4:
                if (user.bot)
                    return [2 /*return*/];
                logger_js_1.logger.debug("begin reaction added handler");
                if (!util.sentFromValidChannel(reaction.message, validSubmissionChannels))
                    return [2 /*return*/];
                //logger.debug("valid channel");
                //logger.debug("reaction emoji ", reaction.emoji.name);
                if (reaction.emoji.name !== "❌")
                    return [2 /*return*/];
                member = reaction.message.guild.member(user.id);
                if (!member)
                    return [2 /*return*/];
                //logger.debug("member ", member);
                if (!reaction.message.reactions.cache.some(function (react) { return react.emoji.name === "🤖"; }))
                    return [2 /*return*/];
                allowedToRemove = reaction.message.author.id === user.id;
                allowedToRemove = allowedToRemove || member.roles.cache.some(function (role) { return rolesThatCanRemoveSubmissions.includes(role.id); });
                if (!allowedToRemove)
                    return [2 /*return*/];
                logger_js_1.logger.debug("right role, clearing reactions and removing file");
                //all conditions clear?
                reaction.message.reactions.removeAll()["catch"](function (err) { return logger_js_1.logger.error("failed to clear all reactions: ", err); });
                scanAndRemoveFile(reaction.message);
                logger_js_1.logger.debug("reaction handler done");
                return [2 /*return*/];
        }
    });
}); });
function validateSubmission(message) {
    return __awaiter(this, void 0, void 0, function () {
        var roles, submission, bug, msg, match, target, msgs, targetMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger_js_1.logger.debug("Message: " + message.content + " in channel: #" + message.channel.name);
                    if (!util.sentFromValidChannel(message, validSubmissionChannels))
                        return [2 /*return*/];
                    roles = message.mentions.roles;
                    if (!roles)
                        return [2 /*return*/];
                    submission = false;
                    bug = false;
                    if (roles.get(roleSuggestionId))
                        submission = true;
                    if (roles.get(roleBugId))
                        bug = true;
                    if (!(submission || bug))
                        return [2 /*return*/];
                    msg = message;
                    match = message.content.match(/^<@&\d+> above (\d+)$/);
                    logger_js_1.logger.debug("match: ", match);
                    if (!match) return [3 /*break*/, 3];
                    target = Number(match[1]) + 1;
                    if (!(message.channel.messages.cache.array().length < target)) return [3 /*break*/, 2];
                    return [4 /*yield*/, message.channel.messages.fetch({ limit: target })["catch"](function (err) { return logger_js_1.logger.error("issue while fetching messages ", err); })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    msgs = message.channel.messages.cache.last(target);
                    targetMessage = msgs[msgs.length - 1];
                    logger_js_1.logger.debug("tm1  ", targetMessage);
                    msg = targetMessage;
                    message["delete"]()["catch"](function (err) { return logger_js_1.logger.error("issue while deleting message ", err.toString()); });
                    if (bug)
                        handleSubmission(msg, "bug");
                    if (submission)
                        handleSubmission(msg, "suggestion");
                    return [2 /*return*/];
                case 3:
                    if (bug)
                        handleSubmission(msg, "bug");
                    if (!submission) return [3 /*break*/, 5];
                    return [4 /*yield*/, confirmSuggestion(msg)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
function confirmSuggestion(msg) {
    return __awaiter(this, void 0, void 0, function () {
        var embed, replyMsg, filter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isFirstSuggestion(msg.author)) {
                        handleSubmission(msg, "suggestion");
                        return [2 /*return*/];
                    }
                    embed = new discord_js_1.MessageEmbed()
                        .setDescription("You are about to submit your first suggestion. I'm sure its a great idea, but maybe you aren't the first one to have it, check [this](https://docs.google.com/spreadsheets/d/1pwX1ZlIIVeLoPXmjNl3amU4iPKpEcbl4FWkOzmYZG5w) spreadsheet to see if its already suggested.\nTry searching for keywords with ctrl + F :)")
                        .setColor(6724095)
                        .addField("Confirm", "Click on the ✅ Checkmark to confirm your submission")
                        .addField("Nevermind", "You have 5 minutes to confirm your submission, otherwise it will just get deleted")
                        .addField("Only once", "This message will NOT appear on your future submission. If you need to check the spreadsheet again type `!suggested`");
                    return [4 /*yield*/, msg.reply(embed)];
                case 1:
                    replyMsg = _a.sent();
                    replyMsg.react("✅")["catch"](function (err) { return logger_js_1.logger.error("issue while adding reactions :(", err); });
                    filter = function (reaction, user) {
                        //logger.debug("filter: u.id:"+user.id + "  a.id:"+msg.author.id);
                        return reaction.emoji.name === "✅" && user.id === msg.author.id;
                    };
                    replyMsg.awaitReactions(filter, { max: 1, time: 300000, errors: ["time"] })
                        .then(function (_collected) {
                        //logger.debug("collection success");
                        var embed = new discord_js_1.MessageEmbed()
                            .setDescription("Thank you for your contribution!");
                        replyMsg.edit(embed);
                        handleSubmission(msg, "suggestion");
                        addUserToList(msg.author);
                        setTimeout(function () { return replyMsg["delete"](); }, 5000);
                    })["catch"](function (_collected) {
                        replyMsg["delete"]();
                        msg["delete"]();
                    });
                    return [2 /*return*/];
            }
        });
    });
}
function isFirstSuggestion(user) {
    var users = importFresh("./data/users.json");
    //logger.debug("list: ",users.suggestors);
    return !users.suggestors.includes(user.id);
}
function addUserToList(user) {
    var users = importFresh("./data/users.json");
    users.suggestors.push(user.id);
    fs.writeFile("./data/users.json", JSON.stringify(users, null, 4), function (err) {
        if (err)
            throw err;
        logger_js_1.logger.info("added user " + user.id + " to the suggestions list");
    });
}
function handleSubmission(msg, type) {
    logger_js_1.logger.info("handling submission: " + msg.content + " of type " + type);
    //save info to local file
    createFile(msg, type);
    //add reactions
    msg.react("🤖")
        .then(function () { return msg.react("👍"); })
        .then(function () { return msg.react("👎"); })
        .then(function () { return msg.react("❌"); })["catch"](function () { return logger_js_1.logger.error("issue while adding reactions :("); });
}
function createFile(msg, subDirectory) {
    //subDirectory should be either suggestion or bug
    var msgTitle = msg.id + ".json";
    var msgLink = "https://discordapp.com/channels/" + msg.guild.id + "/" + msg.channel.id + "/" + msg.id;
    var msgJson = {
        "link": msgLink,
        "type": subDirectory,
        "author": msg.author.tag,
        "msg": msg.content
    };
    fs.writeFile("./data/" + subDirectory + "s/" + msgTitle, JSON.stringify(msgJson, null, 4), function (err) {
        if (err)
            throw err;
        logger_js_1.logger.info("saved to file: " + msgTitle);
    });
}
function scanAndRemoveFile(msg) {
    var msgTitle = msg.id + ".json";
    //suggestions
    fs.access("./data/suggestions/" + msgTitle, function (err) {
        if (err)
            logger_js_1.logger.warn("could not find ./data/suggestions/" + msgTitle + "  didnt't delete");
        else
            removeFile(msgTitle, "suggestion");
    });
    //bugs
    fs.access("./data/bugs/" + msgTitle, function (err) {
        if (err)
            logger_js_1.logger.warn("could not find ./data/bugs/" + msgTitle + "  didnt't delete");
        else
            removeFile(msgTitle, "bug");
    });
}
function removeFile(title, subDirectory) {
    //subDirectory should be either suggestion or bug
    fs.unlink("./data/" + subDirectory + "s/" + title, function (err) {
        if (err)
            logger_js_1.logger.error("issue while removing file ", err);
        else
            logger_js_1.logger.info("removed file: " + title + " of type " + subDirectory);
    });
}
