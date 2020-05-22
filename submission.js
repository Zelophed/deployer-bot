const config = require("./config.json");
const fs = require("fs");
const path = require("path");

const client = require("./client.js");
const util = require('./util.js');

const logger = require('./logger.js');

const validSubmissionChannels = config.validSubmissionChannels;
const rolesThatCanRemoveSubmissions = config.rolesThatCanRemoveSubmissions;
const roleSuggestionId = config.roleSuggestionId;
const roleBugId = config.roleBugId;

//recognize sumbission and store to files
client.on('message', async message => {
    if (message.author.bot) return;

    if (message.guild === null) {
        logger.info("Got a DM: " + message.content);
        return;
    }

    validateSubmission(message);

});

//delete files when message gests deleted
client.on("messageDelete", async (msg) => {
    if (!util.sentFromValidChannel(msg, validSubmissionChannels)) return;
    logger.info("message deleted. " + msg.id + ".json    checking for files")
    scanAndRemoveFile(msg);
})

//remove all reaction and delete file if reacted to the X emoji
client.on("messageReactionAdd", async (reaction, user) => {
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (err) {
            logger.error("error while fetching reaction partial: ", err);
            return;
        }
    }

    if (user.bot) return;

    logger.debug("begin reaction added handler");

    if (!util.sentFromValidChannel(reaction.message, validSubmissionChannels)) return;

    //logger.debug("valid channel");
    //logger.debug("reaction emoji ", reaction.emoji.name);

    if (reaction.emoji.name !== "❌") return;

    //logger.debug("correct emoji");

    var member = reaction.message.guild.member(user);
    if (!member) return;

    //logger.debug("member ", member);
    if (!reaction.message.reactions.cache.some((react) => react.emoji.name === "🤖")) return;

    //check if member has special role;
    var allowedToRemove = reaction.message.author.id === user.id;
    var allowedToRemove = allowedToRemove || member.roles.cache.some(role => rolesThatCanRemoveSubmissions.includes(role.id));
    if (!allowedToRemove) return;

    logger.debug("right role, clearing reactions and removing file");
    //all conditions clear?
    reaction.message.reactions.removeAll().catch(err => logger.error("failed to clear all reactions: ", err));
    scanAndRemoveFile(reaction.message);

    logger.debug("reaction handler done");
});

async function validateSubmission(message) {
    logger.debug("Message: " + message.content + " in channel: #" + message.channel.name);

    if (!util.sentFromValidChannel(message, validSubmissionChannels))
        return;

    var roles = message.mentions.roles;
    if (!roles) return;

    var submission = false;
    var bug = false;
    if (roles.get(roleSuggestionId)) submission = true;
    if (roles.get(roleBugId)) bug = true;

    if (!submission && !bug) return;

    msg = message;
    var match = message.content.match(/^<@&\d+> above (\d+)$/);
    logger.debug("match: ", match);
    if (match) {
        var target = +match[1]+1;
        //logger.debug("target: ", target);
        if (message.channel.messages.cache.array().length < target) {
            await message.channel.messages.fetch({ limit:target }).catch((err) => logger.error("issue while fetching messages ", err));
        }
        msgs = message.channel.messages.cache.last(target);
        targetMessage = msgs[msgs.length-1];
        logger.debug("tm1  ", targetMessage);
        if (targetMessage.partial) {
            await message.channel.messages.cache.fetch(targetMessage.id).then((fetched) => {targetMessage = fetched;}).catch((err) => logger.error("issue while fetching messages ", err));
        }
        logger.debug("tm2  ", targetMessage);
        msg = targetMessage;
        message.delete().catch((err) => logger.error("issue while deleting message ",err));
        if (bug) handleSubmission(msg, "bug");
        if (submission) handleSubmission(msg, "suggestion");
        return;
    }

    if (bug) handleSubmission(msg, "bug");
    if (submission) confirmSuggestion(msg);
}

async function confirmSuggestion(msg) {

    if (!isFirstSuggestion(msg.author)) {
        handleSubmission(msg, "suggestion");
        return;
    }

    var embed = {
        "description": "You are about to submit your first suggestion. I'm sure its a great idea, but maybe you aren't the first one to have it, check [this](https://docs.google.com/spreadsheets/d/1pwX1ZlIIVeLoPXmjNl3amU4iPKpEcbl4FWkOzmYZG5w) spreadsheet to see if its already suggested.\nTry searching for keywords with ctrl + F :)",
        "color": 6724095,
        "fields": [
            {"name": "Confirm", "value": "Click on the ✅ Checkmark to confirm your submission"},
            {"name": "Nevermind", "value": "You have 5 minutes to confirm your submission, otherwise it will just get deleted"},
            {"name": "Only once", "value": "This message will NOT appear on your future submission. If you need to check the spreadsheet again type `!suggested`"},
        ],
    };
    var replyMsg;
    await msg.reply({ embed }).then(reply => {reply.react("✅"); replyMsg = reply;}).catch(err => logger.error("issue while adding reactions :(", err));
    const filter = (reaction, user) => {
        //logger.debug("filter: u.id:"+user.id + "  a.id:"+msg.author.id);
        return reaction.emoji.name === "✅" && user.id === msg.author.id;
    };
    replyMsg.awaitReactions(filter, {max: 1, time: 300000, errors: ["time"] })
        .then(collected => {
            //logger.debug("collection success");
            var embed = {
                "description": "Thank you for your contribution!"
            }
            replyMsg.edit({ embed });
            handleSubmission(msg, "suggestion");
            addUserToList(msg.author);
            setTimeout(() => {
                replyMsg.delete();
            }, 5000);
        })
        .catch(collected => {
            replyMsg.delete();
            msg.delete();
        })

}

function isFirstSuggestion(user) {
    const users = require("./data/users.json");
    logger.debug("list: ",users.suggestors);
    return !users.suggestors.includes(user.id);
}

function addUserToList(user) {
    const users = require("./data/users.json");
    users.suggestors.push(user.id);
    fs.writeFile("./data/users.json", JSON.stringify(users, null, 4), function (err) {
        if (err) throw err;
        logger.info("added user "+user.id+" to the suggestions list");
    });
}

function handleSubmission(msg, type){
    logger.info("handling submission: " + msg.content + " of type " + type);

    //save info to local file
    createFile(msg, type);

    //add reactions
    msg.react("🤖")
        .then(() => msg.react("👍"))
        .then(() => msg.react("👎"))
        .then(() => msg.react("❌"))
        .catch(() => logger.error("issue while adding reactions :("));
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
    }
    fs.writeFile("./data/" + subDirectory + "s/" + msgTitle, JSON.stringify(msgJson, null, 4), function (err) {
        if (err) throw err;
        logger.info("saved to file: " + msgTitle);
    });
}

function scanAndRemoveFile(msg) {
    var msgTitle = msg.id + ".json";
    //suggestions
    fs.access("./data/suggestions/" + msgTitle, (err) => {
        if (err) logger.warn("could not find ./data/suggestions/" + msgTitle + "  didnt't delete");
        else removeFile(msgTitle, "suggestion");
    });
    //bugs
    fs.access("./data/bugs/" + msgTitle, (err) => {
        if (err) logger.warn("could not find ./data/bugs/" + msgTitle + "  didnt't delete");
        else removeFile(msgTitle, "bug");
    });
}

function removeFile(title, subDirectory){
    //subDirectory should be either suggestion or bug
    fs.unlink("./data/" + subDirectory + "s/" + title, (err) => {
        if (err) logger.error("issue while removing file ", err);
        else logger.info("removed file: " + title + " of type " + subDirectory);
    });
}

module.exports = {
    reacted: reactionAdded,
}
