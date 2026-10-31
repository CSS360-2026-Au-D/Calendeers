const event = {
  name: "ready",
  once: true,

  async execute(client) {
    console.log(`
    ############################################################
    #  Logged in as ${client.user.username}!
    #  Serving ${client.guilds.cache.size} servers.
    #  Serving ${client.users.cache.size} users.
    ############################################################
    `);

    for (const guild of client.guilds.cache.values()) {
      const commands = [
        {
          name: "connect",
          description: "Connect your Canvas calendar and Register.UW class schedule"
        },
        {
          name: "schedule",
          description: "View your upcoming calendar events"
        },
        {
          name: "classes",
          description: "View all your classes, meeting days, times, and locations"
        },
        {
          name: "disconnect",
          description: "Remove your linked calendars"
        },
        {
          name: "ping",
          description: "Check whether Calendeers is online"
        },
        {
          name: "upcoming-assignments",
          description: "View upcoming Canvas assignments",
          options: [
              {
                  name: "number-of-days",
                  description: "Number of days to look ahead",
                  type: 4, //Discord option type 4 represents an integer
                  required: true,
                  min_value: 1,
                  max_value: 30
              }
          ]
        },

      ];

      for (const command of commands) {
        await guild.commands.create(command);
      }

      console.log(`Registered /ping in ${guild.name}`);
    }
  },
};

export default event;
