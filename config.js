import "dotenv/config";

/* =========================
   DISCORD
========================= */

export const discordToken = process.env.DISCORD_TOKEN;
export const clientId = process.env.CLIENT_ID;

/* =========================
   ADMIN
========================= */

// Single super-admin (recommended for mainnet)
export const adminDiscordId = process.env.ADMIN_DISCORD_ID;

// 🔒 Force-claim safety switches
export const TEST_MODE =
  process.env.TEST_MODE === "true"; // true | false

export const MAX_FORCE_CLAIM =
  Number(process.env.MAX_FORCE_CLAIM) || 1000;

/* =========================
   CARDANO / BLOCKFROST
========================= */

export const blockfrostApiKey =
  process.env.BLOCKFROST_API_KEY;

// mainnet | testnet
export const blockfrostNetwork =
  process.env.BLOCKFROST_NETWORK || "mainnet";

/* =========================
   NFT COLLECTIONS (LEGACY)
   ⚠️ Deprecated — now managed via DB
========================= */

// Kept only to avoid breaking old code.
// Actual NFT logic uses db.getCollections().
export const nftCollections = [];

/* =========================
   GAME STATE
========================= */

export const gamePaused = false;

export const gameConfig = {
  baseWinChance:
    Number(process.env.BASE_WIN_CHANCE) || 0.25,
  weightPerNFT:
    Number(process.env.WEIGHT_PER_NFT) || 0.03,
  maxWinChance:
    Number(process.env.MAX_WIN_CHANCE) || 0.6,
  cooldownHours:
    Number(process.env.COOLDOWN_HOURS) || 4,
  walletChangeCooldown: 24
};

/* =========================
   REWARD TOKEN
========================= */

export const rewardToken = {
  name: "SNEK",
  unit:
    "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f" +
    "534e454b",
  decimals: 0,
  baseAmount:
    Number(process.env.BASE_REWARD_AMOUNT) || 2
};

/* =========================
   TREASURY WALLET (LUCID)
========================= */

export const treasuryWallet = {
  address: process.env.TREASURY_WALLET_ADDRESS,
  mnemonic: process.env.TREASURY_MNEMONIC
};

/* =========================
   BOSSES (OPTIONAL)
========================= */

export const bosses = [
  {
    name: "Void Herald",
    multiplier: 1.5,
    imageURL:
      "https://cdn.jsdelivr.net/gh/yourusername/yourcdn/void.gif",
    lore: "A shadow that eats courage."
  },
  {
    name: "Night Mother",
    multiplier: 2.0,
    imageURL:
      "https://cdn.jsdelivr.net/gh/yourusername/yourcdn/night.gif",
    lore: "Fate whispers only once."
  }
];

/* =========================
   VISUALS
========================= */

export const trialGIFs = {
  win3:
    "https://ibb.co/zhTGvTQz",
  win2:
    "https://ibb.co/ynWJjT6W",
  loss:
    "https://ibb.co/svBw0BJb"
};

/* =========================
   BOOT LOGS (SAFE)
========================= */

console.log("🌐 Network:", blockfrostNetwork);
console.log(
  "🧪 TEST_MODE:",
  TEST_MODE ? "ENABLED" : "DISABLED"
);
console.log(
  "🔐 TREASURY_MNEMONIC loaded:",
  !!process.env.TREASURY_MNEMONIC
);
