import { SlashCommandBuilder } from "discord.js";
import db from "../db.js";

const WALLET_CHANGE_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

export const data = new SlashCommandBuilder()
  .setName("wallet")
  .setDescription("Register or update your Cardano wallet")
  .addStringOption(opt =>
    opt
      .setName("address")
      .setDescription("Your Cardano wallet address (addr1...)")
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const address = interaction.options
      .getString("address")
      .trim();

    const userId = interaction.user.id;
    const now = Date.now();

    /* ---------- BASIC VALIDATION ---------- */
    if (!address.startsWith("addr")) {
      return interaction.editReply(
        "❌ Invalid Cardano wallet address. Must start with `addr`."
      );
    }

    /* ---------- ENSURE PLAYER EXISTS ---------- */
    await db.createPlayerIfMissing(userId);

    const player = await db.getPlayer(userId);

    if (!player) {
      return interaction.editReply(
        "❌ Failed to load player profile. Try again."
      );
    }

    /* ---------- SAME WALLET CHECK ---------- */
    if (player.wallet_address === address) {
      return interaction.editReply(
        "⚠️ This wallet is already linked to your profile."
      );
    }

    /* ---------- COOLDOWN CHECK ---------- */
    const lastChange = Number(player.last_wallet_change || 0);
    const remaining =
      WALLET_CHANGE_COOLDOWN - (now - lastChange);

    if (lastChange && remaining > 0) {
      const hours = Math.ceil(remaining / 3600000);
      return interaction.editReply(
        `⏳ You can change your wallet again in **${hours} hour(s)**.`
      );
    }

    /* ---------- UPDATE WALLET ---------- */
    await db.updateWallet(userId, address, now);

    return interaction.editReply(
      "✅ **Wallet saved successfully.**\n\n" +
        "⚠️ Rewards will be sent to this address. Make sure you control it."
    );

  } catch (err) {
    console.error("❌ Wallet command error:", err);
    return interaction.editReply(
      "❌ Something went wrong while saving your wallet."
    );
  }
}
