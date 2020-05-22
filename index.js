const fs = require("fs");
const path = require("path");
const config = require("./config.json");

const client = require("./client.js");

//adding and removing submissions
const submission = require("./submission.js");

//list all submissions
const list = require("./list.js")

const logger = require('./logger.js');

const validSubmissionChannels = config.validSubmissionChannels;
const validCommandChannels = config.validCommandChannels;
const rolesThatCanRemoveSubmissions = config.rolesThatCanRemoveSubmissions;
const roleSuggestionId = config.roleSuggestionId;
const roleBugId = config.roleBugId;

client.on('message', async message => {
    if (message.author.bot) return;

    if (message.guild === null) {
        logger.info("Got a DM: " + message.content);
        return;
    }
});

//blameoptifine command
client.on("message", msg => {
    if (msg.author.bot) return;

    if (!msg.content.startsWith("!blameoptifine")) return;

    embed = {
        "description": "If you have Optifine installed, make sure your forge version is set to either **28.2.0** or **28.1.54**, others are likely to conflict with it and will crash the game while launching. See [this issue](https://github.com/sp614x/optifine/issues/3561#issuecomment-602196539) for more info",
        "color": 1146986,
    }

    msg.channel.send({embed});
})


//display link the the spreadsheet
client.on("message", msg => {
    if (msg.author.bot) return;

    if (!msg.content.startsWith("!suggested")) return;

    embed = {
        "description": "Great minds think alike! Please make sure to Ctrl+F on [this spreadsheet](https://docs.google.com/spreadsheets/d/1pwX1ZlIIVeLoPXmjNl3amU4iPKpEcbl4FWkOzmYZG5w) to check whether your idea has been suggested before. Thank you!",
        "color": 6724095,
    }

    msg.channel.send({embed});

});

client.login(config.token);
