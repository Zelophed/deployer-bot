const client = require("./client.js");
const logger = require('./logger.js');
const util = require('./util.js');

//command for listing submissions
client.on("message", async message => {
    if (message.author.bot) return;

    if (!util.sentFromValidChannel(message, validCommandChannels)) return;

    var type;
    if (message.content.startsWith("!suggestions")) type = "suggestion";
    if (message.content.startsWith("!bugs")) type = "bug";
    if (!type) return;

    var files = await readAllFiles(type);
    if (!files) return;

    var thisMessage;
    await message.channel.send("found a total of " + files.length + " submissions for type " + type).then(msg => {
        thisMessage = msg;
    });
    if (files.length < 1) {
        thisMessage.edit(thisMessage.content + "\nnice :)");
        return;
    } else {
        thisMessage.edit(thisMessage.content + "\nbuilding embed, pls wait. \nif this message doesn't disapper after a few seconds, something went wrong. pls ping me");
        var embed = buildEmbedWithFiles(files, type, 0);
        await embed;
        //logger.debug(embed);
        thisMessage.edit("0", { embed });
        thisMessage.react("⏪").then(() => thisMessage.react("⏩")).catch(() => logger.error("issue while adding reactions :("));
        waitForReaction(thisMessage, type);
    }

});

function waitForReaction(msg, type){
    const filter = (reaction, user) => {return ["⏪", "⏩"].includes(reaction.emoji.name) && !user.bot;};
    msg.awaitReactions(filter, {max: 1, time: 600000, errors: ["time"]})//10 minute timeout
        .then(async collected => {
            var reaction = collected.first();
            var indexModify = 0;
            reaction.users.remove(reaction.users.cache.last().id);
            if (reaction.emoji.name === "⏪") indexModify -= 1;
            if (reaction.emoji.name === "⏩") indexModify += 1;
            var files = await readAllFiles(type);
            var newIndex = parseInt(msg.content, 10) + indexModify;
            if (newIndex < 0) newIndex = 0;
            var embed = buildEmbedWithFiles(files, type, newIndex);
            msg.edit(newIndex, {embed});
            waitForReaction(msg, type);
        })
        .catch(collected => {
            msg.reactions.removeAll();
            msg.edit("10 minute timeout passed. type the command again if needed");
            logger.info("reaction timeout, reactions cleared");
        })
}

function buildEmbedWithFiles(files, type, page) {//page 0 = first page
    logger.debug("beign embed build page "+ page);
    color = (type === "suggestion") ? 6724095 : 11342935;
    embed = {
        "color": color,
        "footer": {
            "text": "page " + (page + 1) + " - entries " + (page*10+1) + " to " + (page*10+10) + " of " + files.length
        }
    };

    var initIndex, maxIndex
    if (files.length >= (page+1)*10) {
        //use 10 files
        initIndex = page*10;
        maxIndex = initIndex+9;
    } else if (files.length > page*10) {
        //use 1-9 files
        initIndex = page*10;
        maxIndex = files.length - 1;
    } else {
        //page number to high
        embed["description"] = "page empty ;_;"
        return embed;
    }
    logger.debug("initIndex "+initIndex+"    maxIndex"+maxIndex);
    //logger.debug("files  ", files);
    data = [];
    for (var i = initIndex; i <= maxIndex; i++) {
        var currFile = require("./data/" + type + "s/" + files[i]);
        data.push({
            "name": "entry " + (i+1) + " from " + currFile.author,
            "value": `[link](${currFile.link}) ` + currFile.msg.substring(0,850)
        });
    }
    embed["fields"] = data;
    logger.info("embed build successful");
    return embed;
}

async function readAllFiles(subDirectory) {
    return fs.readdirSync("./data/" + subDirectory + "s/");
}
