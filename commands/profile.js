import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import db from "../db.js";
import { gameConfig } from "../config.js";
import { getNFTCount } from "../utils/blockfrost.js";

const WEEK = 7 * 24 * 60 * 60 * 1000;

/* =========================
   HELPERS
========================= */

function formatCountdown(ms) {
  if (ms <= 0) return "Ready";

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return `${days}d ${hours}h ${minutes}m`;
}

/* =========================
   COMMAND
========================= */

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View your player profile");

/* =========================
   EXECUTION
========================= */

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  /* =========================
     PLAYER CHECK
  ========================= */

  const player = await db.getPlayer(interaction.user.id);

  // Player exists but no wallet → BLOCK
  if (!player || !player.wallet_address) {
    return interaction.editReply(
      "❌ You must register and link a wallet first using `/wallet`."
    );
  }

  /* =========================
     NFT COUNT
  ========================= */

  let nftTotal = Number(player.nft_count || 0);
  let breakdown = {};

  try {
    const nftData = await getNFTCount(player.wallet_address);
    nftTotal = nftData.total;
    breakdown = nftData.breakdown;

    await db.updateNFTCount(
      interaction.user.id,
      nftTotal
    );
  } catch {
    // fallback to stored value
  }

  /* =========================
     WIN PROBABILITY
  ========================= */

  let winProb =
    Number(gameConfig.baseWinChance) +
    nftTotal * Number(gameConfig.weightPerNFT);

  if (winProb > Number(gameConfig.maxWinChance)) {
    winProb = Number(gameConfig.maxWinChance);
  }

  /* =========================
     COOLDOWN (ONLY IF PLAYED)
  ========================= */

  let cooldownText = "Not started";

  if (player.last_trial && Number(player.last_trial) > 0) {
    const cooldownMs =
      Number(gameConfig.cooldownHours) * 3600000;

    const remainingMs =
      cooldownMs - (Date.now() - Number(player.last_trial));

    cooldownText =
      remainingMs > 0
        ? `${Math.ceil(remainingMs / 60000)} min`
        : "Ready";
  }

  /* =========================
     WEEKLY TIMER (INFO ONLY)
  ========================= */

  let weeklyResetText = "Not started";

  if (player.last_trial && Number(player.last_trial) > 0) {
    const nextResetAt =
      Number(player.weekly_reset_at || player.last_trial) +
      WEEK;

    const remainingResetMs =
      nextResetAt - Date.now();

    weeklyResetText =
      formatCountdown(remainingResetMs);
  }

  /* =========================
     NFT BREAKDOWN
  ========================= */

  const breakdownText =
    Object.keys(breakdown).length > 0
      ? Object.entries(breakdown)
          .map(
            ([name, count]) =>
              `• ${name}: **${count}**`
          )
          .join("\n")
      : "No collections detected";

  /* =========================
     EMBED
  ========================= */

  const embed = new EmbedBuilder()
    .setTitle(`🧙 ${interaction.user.username}'s Profile`)
    .setThumbnail(
      interaction.user.displayAvatarURL({ size: 128 })
    )
    .addFields(
      {
        name: "Wallet",
        value: `\`${player.wallet_address.slice(0, 18)}...\``
      },
      {
        name: "NFT Power",
        value: `Total: **${nftTotal}**\n${breakdownText}`
      },
      {
        name: "Win Chance / Round",
        value: `${Math.round(winProb * 100)}%`,
        inline: true
      },
      {
        name: "Weekly Earnings",
        value: `${player.weekly_tokens || 0}`,
        inline: true
      },
      {
        name: "All-Time Earnings",
        value: `${player.total_tokens || 0}`,
        inline: true
      },
      {
        name: "Weekly Reset In",
        value: weeklyResetText,
        inline: true
      },
      {
        name: "Cooldown",
        value: cooldownText,
        inline: true
      }
    )
    .setColor(0x2f3136);

  return interaction.editReply({ embeds: [embed] });
}
