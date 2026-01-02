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
  if (adminDiscordId && interaction.user.id === adminDiscordId) {
    return true;
  }

  if (!interaction.guild) return false;

  if (interaction.guild.ownerId === interaction.user.id) {
    return true;
  }

  return interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  );
}

/* =========================
   COMMAND DEFINITION
========================= */

export const data = new SlashCommandBuilder()
  .setName("admin-resetplayer")
  .setDescription("ADMIN: Reset a player's earnings and timers")
  .setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator
  )
  .addUserOption(opt =>
    opt
      .setName("user")
      .setDescription("Player to reset")
      .setRequired(true)
  );

/* =========================
   EXECUTION
========================= */

export async function execute(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "⛔ Admins only.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const targetUser =
    interaction.options.getUser("user");

  const player = await db.getPlayer(targetUser.id);

  if (!player) {
    return interaction.editReply(
      "❌ Player not found in database."
    );
  }

  /* =========================
     RESET PLAYER STATE
     (SAFE / NON-DESTRUCTIVE)
  ========================= */

  await db.pool.query(
    `
    UPDATE players
    SET
      weekly_tokens = 0,
      weekly_reset_at = NULL,
      last_trial = NULL
      -- total_tokens = total_tokens -- 👈 intentionally untouched
    WHERE discord_id = $1
    `,
    [targetUser.id]
  );

  return interaction.editReply(
    `✅ **Player Reset Successful**\n\n` +
      `👤 Player: **${targetUser.username}**\n` +
      `🧹 Weekly balance cleared\n` +
      `⏳ Weekly timer reset\n` +
      `⚔️ Cooldown cleared\n\n` +
      `Player can start fresh immediately.`
  );
}
