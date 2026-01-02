import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import db from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("admin-setcooldown")
  .setDescription("Admin: set game cooldown (hours)")
  .setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator // hidden
  )
  .addNumberOption(opt =>
    opt
      .setName("hours")
      .setDescription("Cooldown in hours (e.g. 0.0833 = 5 minutes)")
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

  const hours = interaction.options.getNumber("hours");

  if (typeof hours !== "number" || hours < 0) {
    return interaction.reply({
      content: "❌ Invalid cooldown value.",
      ephemeral: true
    });
  }

  try {
    await db.pool.query(
      `
      INSERT INTO game_settings (key, value)
      VALUES ('cooldownHours', $1)
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value
      `,
      [String(hours)]
    );

    return interaction.reply({
      content:
        `⏳ **Cooldown Updated**\n\n` +
        `New cooldown: **${hours} hour(s)**`,
      ephemeral: true
    });

  } catch (err) {
    console.error("❌ admin-setcooldown error:", err);
    return interaction.reply({
      content: "❌ Failed to update cooldown.",
      ephemeral: true
    });
  }
}
