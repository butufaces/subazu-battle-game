import "dotenv/config";
import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { discordToken, clientId } from "./config.js";
import { startKeepAlive } from "./keepalive.js";
import { initDB } from "./db.js";

/* =========================
   FIX __dirname
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================
   ENV VALIDATION
========================= */
const GUILD_ID = String(process.env.GUILD_ID || "").trim();

if (!discordToken || !clientId) {
  console.error("❌ DISCORD_TOKEN or CLIENT_ID missing");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("❌ GUILD_ID missing in .env");
  process.exit(1);
}

/* =========================
   KEEP ALIVE (Render-safe)
========================= */
startKeepAlive();

/* =========================
   INIT DATABASE (PostgreSQL)
========================= */
await initDB();

/* =========================
   CLIENT
========================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

/* =========================
   LOAD COMMAND FILES
========================= */
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const fileUrl = pathToFileURL(filePath).href;

  const mod = await import(fileUrl);
  const command = mod.default || mod;

  if (!command?.data || !command?.execute) {
    console.warn(`⚠️ Skipping invalid command: ${file}`);
    continue;
  }

  client.commands.set(command.data.name, command);
}

/* =========================
   READY EVENT
========================= */
client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`🔒 Locked to guild: ${GUILD_ID}`);

  const rest = new REST({ version: "10" }).setToken(discordToken);

  try {
    await rest.put(
      Routes.applicationGuildCommands(clientId, GUILD_ID),
      {
        body: client.commands.map(cmd => cmd.data.toJSON())
      }
    );
    console.log("✅ Slash commands registered (guild-only)");
  } catch (err) {
    console.error("❌ Slash command registration failed:", err);
  }

  // 🧹 Leave unauthorized servers (only AFTER ready)
  for (const guild of client.guilds.cache.values()) {
    if (guild.id !== GUILD_ID) {
      console.warn(
        `🚫 Leaving unauthorized guild: ${guild.name} (${guild.id})`
      );
      try {
        await guild.leave();
      } catch (err) {
        console.error("❌ Failed to leave guild", err);
      }
    }
  }
});

/* =========================
   BLOCK FUTURE INVITES
========================= */
client.on("guildCreate", async guild => {
  if (guild.id !== GUILD_ID) {
    console.warn(
      `🚫 Unauthorized invite attempt: ${guild.name} (${guild.id})`
    );
    try {
      await guild.leave();
      console.log("✅ Left unauthorized guild");
    } catch (err) {
      console.error("❌ Failed to leave guild", err);
    }
  }
});

/* =========================
   INTERACTION HANDLER
========================= */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.guildId !== GUILD_ID) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(
      `❌ Error in /${interaction.commandName}`,
      err
    );

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "⚠️ Command execution failed.",
          ephemeral: true
        });
      } catch {}
    }
  }
});

/* =========================
   LOGIN
========================= */
client.login(discordToken);
