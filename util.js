
module.exports.sentFromValidChannel = function(message, validChannels) {
    var id = message.channel.id;
    return validChannels.includes(id);
}
