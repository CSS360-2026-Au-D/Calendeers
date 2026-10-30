
const event = {
  name: "messageCreate",

  async execute(message) {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Respond to !ping
    if (message.content.toLowerCase() === "!ping") {
      await message.reply("Pong! 🏓");
    }
  },
};

export default event;
