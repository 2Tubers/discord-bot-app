
const GUILD_ID = "1553856756034306180"
const APP_ID = process.env.DISCORD_APP_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const url = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`;

if (!APP_ID || !BOT_TOKEN) {
  console.error("Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN");
  console.error("   Set them as environment variables before running.");
  process.exit(1);
}

// Define Your Commands 

const commands = [
  {
    name: "report",
    description: "Submit a report — opens a form",
    // the modal handles input 
  },
  {
    name: "status",
    description: "Check if the bot is online and operational",
  },
];


async function registerCommands() {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;


  for (const command of commands) {
    console.log(`Registering /${command.name}...`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${BOT_TOKEN}`,
      },
      body: JSON.stringify(command),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ /${command.name} registered (id: ${data.id})`);
    } else {
      const error = await response.text();
      console.error(`  ❌ Failed to register /${command.name}:`, error);
    }
  }

  console.log("\nDone! Global commands may take up to 1 hour to appear.");
  console.log(
    "Tip: Use guild commands (see comment in code) for instant testing."
  );
}

registerCommands();