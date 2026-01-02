import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import db from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Top players this week");

export async function execute(interaction) {
  try {
    /* =========================
       WEEKLY LEADERBOARD
       RULES:
       - wallet must exist
       - player must have played at least once
       - weekly_tokens > 0
    ========================= */

    const { rows } = await db.pool.query(
      `
      SELECT discord_id, weekly_tokens
      FROM players
      WHERE wallet_address IS NOT NULL
        AND wallet_address != ''
        AND last_trial IS NOT NULL
        AND weekly_tokens > 0
      ORDER BY weekly_tokens DESC
      LIMIT 10
      `
    );

    if (!rows.length) {
      return interaction.reply({
        content: "📭 No eligible players on the leaderboard yet.",
        ephemeral: true
      });
    }

    const desc = rows
      .map(
        (r, i) =>
          `**${i + 1}.** <@${r.discord_id}> — **${r.weekly_tokens}**`
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🏆 Weekly Leaderboard")
      .setDescription(desc)
      .setColor(0xf1c40f)
      .setFooter({
        text: "Only active players with wallets are ranked"
      });

    return interaction.reply({ embeds: [embed] });

  } catch (err) {
    console.error("❌ Leaderboard error:", err);
    return interaction.reply({
      content: "❌ Failed to load leaderboard.",
      ephemeral: true
    });
  }
}
