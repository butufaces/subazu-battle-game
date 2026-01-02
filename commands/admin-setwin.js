import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import db from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("admin-setwin")
  .setDescription("Admin: set base win probability")
  .setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator // hidden
  )
  .addNumberOption(opt =>
    opt
      .setName("value")
      .setDescription("Base win chance (0.01 – 0.99)")
      .setRequired(true)
  );

export async function execute(interaction) {
  /* ---------- PERMISSION GUARD ---------- */
  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    )
  ) {
    return interaction.reply({
      content: "⛔ Admins only.",
      ephemeral: true
    });
  }

  const value = interaction.options.getNumber("value");

  if (
    typeof value !== "number" ||
    value <= 0 ||
    value >= 1
  ) {
    return interaction.reply({
      content:
        "❌ Invalid value.\nUse a number between **0.01** and **0.99** (e.g. `0.25`).",
      ephemeral: true
    });
  }

  try {
    await db.pool.query(
      `
      INSERT INTO game_settings (key, value)
      VALUES ('baseWinChance', $1)
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value
      `,
      [String(value)]
    );

    return interaction.reply({
      content:
        `🎯 **Base Win Chance Updated**\n\n` +
        `New value: **${Math.round(value * 100)}%**`,
      ephemeral: true
    });

  } catch (err) {
    console.error("❌ admin-setwin error:", err);
    return interaction.reply({
      content: "❌ Failed to update base win chance.",
      ephemeral: true
    });
  }
}
