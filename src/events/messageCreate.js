const event = {
  name: "messageCreate",

  async execute(message) {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Only respond to the help command
    if (message.content.toLowerCase() !== "!help") return;

    const helpMessage = `
📚 **Calendeers Bot Help**

Here are the available commands:

🔹 **!help**
Shows this help message.

📌 **Other Features**
• Welcome Message - Welcomes new members to the server.
• Assignment Reminder - Reminds students about upcoming assignments.
• Missing Assignments - Use \`/missing\` to see past-due assignments you haven't marked done.
`;

    await message.reply(helpMessage);
  },
};

export default event;