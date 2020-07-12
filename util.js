"use strict";
exports.__esModule = true;
function sentFromValidChannel(message, validChannels) {
    return validChannels.includes(message.channel.id);
}
exports.sentFromValidChannel = sentFromValidChannel;
