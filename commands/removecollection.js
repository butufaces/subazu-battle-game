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
  .setName("removecollection")
  .setDescription("Admin: remove an NFT collection")
  .setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator // 👈 hidden from non-admins
  )
  .addStringOption(opt =>
    opt
      .setName("policyid")
      .setDescription("Policy ID of the collection to remove")
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

  const policyId =
    interaction.options.getString("policyid").trim();

  try {
    /* ---------- CHECK EXISTS ---------- */
    const { rows } = await db.pool.query(
      `SELECT name FROM nft_collections WHERE policy_id = $1`,
      [policyId]
    );

    if (!rows.length) {
      return interaction.reply({
        content: "❌ Collection not found.",
        ephemeral: true
      });
    }

    const name = rows[0].name;

    /* ---------- DELETE ---------- */
    await db.pool.query(
      `DELETE FROM nft_collections WHERE policy_id = $1`,
      [policyId]
    );

    return interaction.reply({
      content:
        `🗑️ **Collection Removed**\n\n` +
        `Name: **${name}**\n` +
        `Policy ID: \`${policyId}\``,
      ephemeral: true
    });

  } catch (err) {
    console.error("❌ removecollection error:", err);
    return interaction.reply({
      content: "❌ Failed to remove collection.",
      ephemeral: true
    });
  }
}
