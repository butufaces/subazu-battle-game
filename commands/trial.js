import { SlashCommandBuilder } from "discord.js";
import db from "../db.js";
import {
  gameConfig,
  rewardToken,
  trialGIFs
} from "../config.js";
import { getNFTCount } from "../utils/blockfrost.js";

/* =========================
   HELPERS
========================= */

const battleActions = [
  "⚔️ Blades clash violently in the arena…",
  "🔥 Flames erupt as attacks collide…",
  "🛡️ Shields shatter under heavy impact…",
  "⚡ Lightning splits the battlefield…",
  "💥 A devastating strike lands!",
  "👁️ The enemy hesitates, reading the move…",
  "🏹 A precise blow cuts through the air…",
  "🩸 The ground trembles beneath the fighters…",
  "🗡️ Steel screams as blades meet!",
  "🌪️ A violent shockwave tears through the arena!",
  "💢 A crushing blow staggers the enemy!",
  "⚔️ A feint… then a deadly counter!",
  "🔥 Sparks fly as weapons collide!",
  "🧠 A calculated strike finds its mark!",
  "💀 A ruthless attack leaves scars!",
  "⚡ A sudden surge of power changes the tide!",
  "🩸 Blood stains the battleground!",
  "🛡️ Defense falters under pressure!"
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function rollWin(prob) {
  return Math.random() < prob;
}

/* =========================
   COMMAND
========================= */

export const data = new SlashCommandBuilder()
  .setName("trial")
  .setDescription("Enter a public 3-round battle trial");

/* =========================
   EXECUTION
========================= */

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: false });

  /* =========================
     PLAYER VALIDATION
  ========================= */

  const player = await db.getPlayer(interaction.user.id);

  if (!player || !player.wallet_address) {
    return interaction.editReply(
      "❌ You must register and link a wallet first using `/wallet`."
    );
  }

  /* =========================
     COOLDOWN (STARTS AFTER FIRST PLAY)
  ========================= */

  if (player.last_trial && Number(player.last_trial) > 0) {
    const cooldownMs =
      Number(gameConfig.cooldownHours) * 60 * 60 * 1000;

    const remainingMs =
      cooldownMs - (Date.now() - Number(player.last_trial));

    if (remainingMs > 0) {
      const minutes = Math.ceil(remainingMs / 60000);
      return interaction.editReply(
        `⏳ **Cooldown Active**\nTry again in **${minutes} minute(s)**.`
      );
    }
  }

  /* =========================
     NFT CHECK
  ========================= */

  const { total: nftCount } =
    await getNFTCount(player.wallet_address);

  if (nftCount <= 0) {
    return interaction.editReply(
      "🚫 **Entry Denied**\nOnly NFT holders may enter the trial."
    );
  }

  /* =========================
     WIN PROBABILITY
  ========================= */

  let winProb =
    Number(gameConfig.baseWinChance) +
    nftCount * Number(gameConfig.weightPerNFT);

  if (winProb > Number(gameConfig.maxWinChance)) {
    winProb = Number(gameConfig.maxWinChance);
  }

  /* =========================
     ANNOUNCEMENT
  ========================= */

  await interaction.editReply(
    `🎮 **Battle Announcement**\n` +
      `Fighter: **${interaction.user.username}**\n` +
      `NFT Power: **${nftCount}**\n` +
      `Win Chance / Round: **${Math.round(winProb * 100)}%**\n` +
      `Rounds: **3**\n\n` +
      `⚔️ The crowd goes silent…`
  );

  await sleep(2000);

  /* =========================
     BATTLE ROUNDS
  ========================= */

  let wins = 0;

  for (let round = 1; round <= 3; round++) {
    await interaction.editReply(`⚔️ **Round ${round} Begins!**`);
    await sleep(1200);

    const action =
      battleActions[Math.floor(Math.random() * battleActions.length)];

    await interaction.editReply(
      `⚔️ **Round ${round} – Battle**\n${action}`
    );

    await sleep(1400);

    const won = rollWin(winProb);
    if (won) wins++;

    await interaction.editReply(
      `⚔️ **Round ${round} Ends**\nResult: ${won ? "✅ Victory!" : "❌ Defeat!"}`
    );

    await sleep(1200);
  }

  /* =========================
     REWARD CALCULATION
  ========================= */

  let reward = 0;
  let gif = trialGIFs.loss;

  if (wins === 2) {
    reward = Number(rewardToken.baseAmount);
    gif = trialGIFs.win2;
  } else if (wins === 3) {
    reward = Number(rewardToken.baseAmount) * 2;
    gif = trialGIFs.win3;
  }

  /* =========================
     SAVE GAME STATE
     (NO RESET HERE — EVER)
  ========================= */

  await db.updateLastTrial(interaction.user.id);

  if (reward > 0) {
    await db.addTokens(interaction.user.id, reward);
  }

  /* =========================
     FINAL MESSAGE
  ========================= */

  return interaction.editReply({
    content:
      `🏁 **Trial Complete**\n` +
      `Victories: **${wins}/3**\n` +
      `🪙 Earned This Trial: **${reward} ${rewardToken.name}**\n\n` +
      `📦 Rewards are stored in your **weekly balance**.\n` +
      `⛓ Earnings **accumulate until claimed**.\n` +
      `Use \`/profile\` to track progress.`,
    files: [gif]
  });
}
