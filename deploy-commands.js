require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const command = new SlashCommandBuilder()
  .setName("setup-checklist")
  .setDescription("Create or repost the shared server checklist in this channel.");

const required = ["DISCORD_TOKEN", "CLIENT_ID", "GUILD_ID"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Check your .env file.`);
    process.exit(1);
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: [command.toJSON()] }
    );
    console.log("Registered /setup-checklist in your server.");
  } catch (error) {
    console.error(error);
  }
})();
