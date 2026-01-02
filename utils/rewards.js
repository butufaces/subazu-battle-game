import { Lucid, Blockfrost } from "lucid-cardano";
import {
  blockfrostApiKey,
  blockfrostNetwork,
  rewardToken,
  treasuryWallet,
  adminDiscordId
} from "../config.js";

/* =========================
   CONSTANTS
========================= */

// 2 ADA min-UTxO is the usual safe floor for a token output.
// If your token output ever fails due to min-UTxO rules, raise this to 3_000_000n.
const ADA_MIN_UTXO = 2_000_000n;

// Extra ADA buffer to cover fees, change outputs, and random chain weirdness.
const ADA_FEE_BUFFER = 2_000_000n;

// 1 tx per 5 seconds
const PAYOUT_RATE_LIMIT_MS = 5000;

/* =========================
   BLOCKFROST URL
========================= */

const BLOCKFROST_URL =
  blockfrostNetwork === "mainnet"
    ? "https://cardano-mainnet.blockfrost.io/api/v0"
    : "https://cardano-testnet.blockfrost.io/api/v0";

/* =========================
   LUCID SETUP
========================= */

let lucidInstance = null;
let lastPayoutAt = 0;

async function getLucid() {
  if (lucidInstance) return lucidInstance;

  if (!treasuryWallet?.mnemonic) {
    throw new Error("TREASURY_MNEMONIC missing in config");
  }

  if (!blockfrostApiKey) {
    throw new Error("BLOCKFROST_API_KEY missing in env/config");
  }

  const lucid = await Lucid.new(
    new Blockfrost(BLOCKFROST_URL, blockfrostApiKey),
    blockfrostNetwork === "mainnet" ? "Mainnet" : "Testnet"
  );

  await lucid.selectWalletFromSeed(treasuryWallet.mnemonic.trim());

  console.log(
    `🔐 Treasury wallet loaded on ${blockfrostNetwork.toUpperCase()}`
  );

  lucidInstance = lucid;
  return lucid;
}

/* =========================
   HELPERS
========================= */

function toRaw(amountHuman) {
  const decimals = BigInt(rewardToken.decimals ?? 0);
  return BigInt(amountHuman) * 10n ** decimals;
}

function applyMultiplier(amountHuman, bossMultiplier = 1) {
  const m = Number(bossMultiplier ?? 1);

  if (!Number.isFinite(m) || m <= 0) return amountHuman;

  // Keep it deterministic:
  // - if multiplier causes decimals, we floor to avoid overpaying.
  // - Your token has decimals:0 anyway, so it’ll be clean.
  const scaled = Math.floor(Number(amountHuman) * m);
  return scaled > 0 ? scaled : amountHuman;
}

/* =========================
   TREASURY BALANCES
========================= */

export async function getTreasuryBalances() {
  const lucid = await getLucid();
  const utxos = await lucid.wallet.getUtxos();

  let ada = 0n;
  let tokenRaw = 0n;

  for (const utxo of utxos) {
    if (utxo.assets?.lovelace) {
      ada += BigInt(utxo.assets.lovelace);
    }

    if (utxo.assets?.[rewardToken.unit]) {
      tokenRaw += BigInt(utxo.assets[rewardToken.unit]);
    }
  }

  return { ada, tokenRaw };
}

/* =========================
   TREASURY SAFETY CHECK
   - includes min-UTxO + fee buffer
   - supports boss multiplier
========================= */

export async function treasuryHasFunds(minAdaLovelace, minTokenHuman, bossMultiplier = 1) {
  const { ada, tokenRaw } = await getTreasuryBalances();

  const neededHuman = applyMultiplier(minTokenHuman, bossMultiplier);
  const requiredTokenRaw = toRaw(neededHuman);

  const adaRequired =
    BigInt(minAdaLovelace) +
    ADA_MIN_UTXO + // to make the token output valid
    ADA_FEE_BUFFER; // fee/change buffer

  return {
    ok: ada >= adaRequired && tokenRaw >= requiredTokenRaw,
    ada,
    tokenRaw,
    required: {
      adaRequired,
      tokenRequiredRaw: requiredTokenRaw,
      tokenRequiredHuman: neededHuman
    }
  };
}

/* =========================
   ADMIN LOW TREASURY ALERT
========================= */

let lastTreasuryAlert = 0;

export async function notifyAdminLowTreasury(client, ada, tokenRaw) {
  if (!adminDiscordId) return;

  const now = Date.now();
  if (now - lastTreasuryAlert < 30 * 60 * 1000) return;

  lastTreasuryAlert = now;

  try {
    const admin = await client.users.fetch(adminDiscordId);
    if (!admin) return;

    await admin.send(
      `⚠️ **TREASURY LOW ALERT**\n\n` +
        `Network: **${blockfrostNetwork}**\n` +
        `ADA: ${(Number(ada) / 1_000_000).toFixed(2)} ADA\n` +
        `${rewardToken.name}: ${tokenRaw.toString()} (raw)\n\n` +
        `Min UTxO: ${(Number(ADA_MIN_UTXO) / 1_000_000).toFixed(2)} ADA\n` +
        `Fee Buffer: ${(Number(ADA_FEE_BUFFER) / 1_000_000).toFixed(2)} ADA`
    );
  } catch (err) {
    console.error("❌ Failed to notify admin:", err.message);
  }
}

/* =========================
   SEND TOKEN REWARD (HARDENED)
   - supports boss multiplier
   - includes min-UTxO lovelace
========================= */

export async function sendTokenReward(toAddress, amountHuman, bossMultiplier = 1) {
  if (!toAddress) throw new Error("INVALID_ADDRESS");

  if (typeof amountHuman !== "number" || amountHuman <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  // apply boss multiplier (optional)
  const finalHuman = applyMultiplier(amountHuman, bossMultiplier);

  if (!Number.isFinite(finalHuman) || finalHuman <= 0) {
    throw new Error("INVALID_MULTIPLIED_AMOUNT");
  }

  // ⏱ Rate limit payouts
  const now = Date.now();
  if (now - lastPayoutAt < PAYOUT_RATE_LIMIT_MS) {
    throw new Error("PAYOUT_RATE_LIMIT");
  }
  lastPayoutAt = now;

  const lucid = await getLucid();
  const amountRaw = toRaw(finalHuman);

  try {
    const tx = await lucid
      .newTx()
      .payToAddress(toAddress, {
        lovelace: ADA_MIN_UTXO,
        [rewardToken.unit]: amountRaw
      })
      .complete();

    const signed = await tx.sign().complete();
    const txHash = await signed.submit();

    console.log(
      `✅ Reward sent on ${blockfrostNetwork} | ${finalHuman} ${rewardToken.name}` +
        (bossMultiplier && bossMultiplier !== 1 ? ` (x${bossMultiplier})` : "") +
        ` | TX: ${txHash}`
    );

    return txHash;
  } catch (err) {
    console.error("❌ Reward TX failed:", err);
    throw new Error("TREASURY_TX_FAILED");
  }
}
