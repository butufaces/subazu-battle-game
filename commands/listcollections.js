import {
  SlashCommandBuilder,
  EmbedBuilder,
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
  .setName("listcollections")
  .setDescription("Admin: list all registered NFT collections")
  .setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator // 👈 hidden from non-admins
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

  try {
    const { rows } = await db.pool.query(
      `SELECT policy_id, name FROM nft_collections ORDER BY name ASC`
    );

    if (!rows.length) {
      return interaction.reply({
        content: "📭 No NFT collections registered yet.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("🧩 Registered NFT Collections")
      .setDescription(
        rows
          .map(
            (c, i) =>
              `**${i + 1}. ${c.name}**\nPolicy ID: \`${c.policy_id}\``
          )
          .join("\n\n")
      )
      .setColor(0x5865f2);

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });

  } catch (err) {
    console.error("❌ listcollections error:", err);
    return interaction.reply({
      content: "❌ Failed to load collections.",
      ephemeral: true
    });
  }
}
