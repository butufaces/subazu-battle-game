import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import db from "../db.js";
import {
  sendTokenReward,
  treasuryHasFunds,
  notifyAdminLowTreasury
} from "../utils/rewards.js";
import {
  rewardToken,
  adminDiscordId,
  TEST_MODE,
  MAX_FORCE_CLAIM
} from "../config.js";

export const data = new SlashCommandBuilder()
  .setName("admin-force-claim")
  .setDescription(
    "ADMIN: Force claim weekly rewards (testing only)"
  )
  .setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator
  )
  .addUserOption(opt =>
    opt
      .setName("user")
      .setDescription("Player to force claim for")
      .setRequired(true)
  );

export async function execute(interaction) {
  /* =========================
     AUTHORIZATION
  ========================= */

  const isOwner =
    interaction.guild &&
    interaction.guild.ownerId === interaction.user.id;

  const isAdminPermission =
    interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    );

  const isAdminId =
    adminDiscordId &&
    interaction.user.id === adminDiscordId;

  if (!isOwner && !isAdminPermission && !isAdminId) {
    return interaction.reply({
      content:
        "⛔ You are not authorized to use this command.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  /* =========================
     TEST MODE
  ========================= */

  if (TEST_MODE === false) {
    return interaction.editReply(
      "🚫 Force-claim is disabled on mainnet."
    );
  }

  const targetUser =
    interaction.options.getUser("user");

  /* =========================
     PLAYER
  ========================= */

  const player = await db.getPlayer(targetUser.id);

  if (!player || !player.wallet_address) {
    return interaction.editReply(
      "❌ Player has no registered wallet."
    );
  }

  const weeklyAmount = Number(
    player.weekly_tokens || 0
  );

  if (weeklyAmount <= 0) {
    return interaction.editReply(
      "📦 Player has no weekly rewards to claim."
    );
  }

  /* =========================
     SAFETY CAP
  ========================= */

  if (
    MAX_FORCE_CLAIM &&
    weeklyAmount > MAX_FORCE_CLAIM
  ) {
    return interaction.editReply(
      `🚫 Force-claim blocked.\n` +
        `Amount (${weeklyAmount}) exceeds max allowed (${MAX_FORCE_CLAIM}).`
    );
  }

  /* =========================
     TREASURY CHECK
  ========================= */

  const treasury = await treasuryHasFunds(
    3_000_000, // ADA buffer
    weeklyAmount
  );

  if (!treasury.ok) {
    await notifyAdminLowTreasury(
      interaction.client,
      treasury.ada,
      treasury.tokenRaw
    );

    return interaction.editReply(
      "🌀 Treasury too low to process force claim."
    );
  }

  /* =========================
     SEND REWARD
  ========================= */

  let txHash;
  try {
    txHash = await sendTokenReward(
      player.wallet_address,
      weeklyAmount
    );
  } catch (err) {
    console.error(
      "❌ Admin force claim failed:",
      err
    );
    return interaction.editReply(
      "❌ Transfer failed."
    );
  }

  /* =========================
     RESET WEEKLY STATE
  ========================= */

  await db.handleWeeklyReset(player);

  await db.recordTransaction(
    txHash,
    targetUser.id,
    weeklyAmount
  );

  /* =========================
     SUCCESS
  ========================= */

  return interaction.editReply(
    `✅ **Force Claim Successful**\n\n` +
      `👤 Player: **${targetUser.username}**\n` +
      `💰 Amount: **${weeklyAmount} ${rewardToken.name}**\n` +
      `🔗 TX: \`${txHash}\`\n\n` +
      `Weekly balance has been reset.`
  );
}
