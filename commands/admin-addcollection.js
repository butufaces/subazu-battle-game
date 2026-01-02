import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import db from "../db.js";
import { adminDiscordId } from "../config.js";

/* =========================
   ADMIN CHECK
========================= */
function isAdmin(interaction) {
  if (adminDiscordId && interaction.user.id === adminDiscordId) return true;
  if (!interaction.guild) return false;
  if (interaction.guild.ownerId === interaction.user.id) return true;

  return interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  );
}

/* =========================
   COMMAND DEFINITION
========================= */
export const data = new SlashCommandBuilder()
  .setName("addcollection")
  .setDescription("Admin: add a new NFT collection")
  .setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator // 👈 hidden from non-admins
  )
  .addStringOption(opt =>
    opt
      .setName("name")
      .setDescription("Collection display name")
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt
      .setName("policyid")
      .setDescription("NFT policy ID")
      .setRequired(true)
  );

/* =========================
   EXECUTION
========================= */
export async function execute(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "🚫 Admin only command.",
      ephemeral: true
    });
  }

  const name = interaction.options.getString("name").trim();
  const policyId = interaction.options
    .getString("policyid")
    .trim();

  try {
    await db.pool.query(
      `
      INSERT INTO nft_collections (policy_id, name)
      VALUES ($1, $2)
      ON CONFLICT (policy_id) DO NOTHING
      `,
      [policyId, name]
    );

    return interaction.reply({
      content:
        `✅ **Collection Added**\n\n` +
        `Name: **${name}**\n` +
        `Policy ID: \`${policyId}\``,
      ephemeral: true
    });

  } catch (err) {
    console.error("❌ addcollection error:", err);
    return interaction.reply({
      content: "❌ Failed to add collection.",
      ephemeral: true
    });
  }
}
