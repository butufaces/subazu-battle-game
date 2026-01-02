import { SlashCommandBuilder } from "discord.js";
import db from "../db.js";
import {
  sendTokenReward,
  treasuryHasFunds,
  notifyAdminLowTreasury
} from "../utils/rewards.js";
import { rewardToken } from "../config.js";

const WEEK = 7 * 24 * 60 * 60 * 1000;

function formatCountdown(ms) {
  if (ms <= 0) return "Ready to claim";

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return `${days}d ${hours}h ${minutes}m`;
}

export const data = new SlashCommandBuilder()
  .setName("claim")
  .setDescription("Claim your accumulated weekly token rewards");

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  /* =========================
     PLAYER CHECK
  ========================= */

  let player = await db.getPlayer(interaction.user.id);

  if (!player || !player.wallet_address) {
    return interaction.editReply(
      "❌ You must register and link a wallet first using `/wallet`."
    );
  }

  /* =========================
     CLAIM TIMER LOCK
     (DOES NOT TOUCH BALANCE)
  ========================= */

  if (player.weekly_reset_at) {
    const unlockAt =
      Number(player.weekly_reset_at) + WEEK;

    const remainingMs = unlockAt - Date.now();

    if (remainingMs > 0) {
      return interaction.editReply(
        `⛔ **Claim Locked**\n\n` +
          `Next claim available in **${formatCountdown(remainingMs)}**`
      );
    }
  }

  /* =========================
     BALANCE CHECK
  ========================= */

  const weeklyAmount = Number(player.weekly_tokens || 0);

  if (weeklyAmount <= 0) {
    return interaction.editReply(
      "📦 You have no rewards to claim."
    );
  }

  /* =========================
     TREASURY SAFETY CHECK
  ========================= */

  const treasury = await treasuryHasFunds(
    3_500_000, // ✅ min-ADA + fee buffer
    weeklyAmount
  );

  if (!treasury.ok) {
    await notifyAdminLowTreasury(
      interaction.client,
      treasury.ada,
      treasury.tokenRaw
    );

    return interaction.editReply(
      "🌀 Treasury is currently low. Please try again later."
    );
  }

  /* =========================
     SEND REWARD (ON-CHAIN)
     NOTHING CLEARS BEFORE THIS
  ========================= */

  let txHash;
  try {
    txHash = await sendTokenReward(
      player.wallet_address,
      weeklyAmount
    );
  } catch (err) {
    console.error("❌ Claim payout failed:", err);
    return interaction.editReply(
      "❌ Reward transfer failed. Your balance is safe. Try again later."
    );
  }

  /* =========================
     POST-SUCCESS RESET (LOCK PATCH)
     ONLY RUNS AFTER TX SUCCESS
  ========================= */

  await db.pool.query(
    `
    UPDATE players
    SET weekly_tokens = 0,
        weekly_reset_at = $1
    WHERE discord_id = $2
    `,
    [Date.now(), interaction.user.id]
  );

  await db.recordTransaction(
    txHash,
    interaction.user.id,
    weeklyAmount
  );

  /* =========================
     SUCCESS RESPONSE
  ========================= */

  return interaction.editReply(
    `✅ **Claim Successful!**\n\n` +
      `💰 Amount: **${weeklyAmount} ${rewardToken.name}**\n` +
      `🔗 TX Hash: \`${txHash}\`\n\n` +
      `⏳ Claim timer has been reset.\n` +
      `📦 Earnings will now accumulate for the next cycle.`
  );
}
