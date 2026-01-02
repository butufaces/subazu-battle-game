import pg from "pg";
const { Pool } = pg;

/* =========================
   DATABASE CONNECTION
========================= */

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false
});

/* =========================
   INIT DB
========================= */

export async function initDB() {
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL connected");

    /* =========================
       PLAYERS
    ========================= */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        discord_id TEXT PRIMARY KEY,
        wallet_address TEXT,

        nft_count INTEGER DEFAULT 0,

        -- gameplay
        first_play_at BIGINT DEFAULT 0,
        last_trial BIGINT DEFAULT 0,

        -- earnings
        total_tokens INTEGER DEFAULT 0,
        weekly_tokens INTEGER DEFAULT 0,

        -- timers
        weekly_reset_at BIGINT DEFAULT 0,
        last_wallet_change BIGINT DEFAULT 0
      );
    `);

    /* =========================
       TRANSACTIONS
    ========================= */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        tx_id TEXT PRIMARY KEY,
        discord_id TEXT,
        amount INTEGER,
        timestamp BIGINT
      );
    `);

    /* =========================
       NFT COLLECTIONS
    ========================= */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS nft_collections (
        policy_id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);

    /* =========================
       GAME SETTINGS
    ========================= */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    await pool.query(`
      INSERT INTO game_settings (key, value) VALUES
        ('cooldown_hours', '6'),
        ('base_win_chance', '0.55'),
        ('weight_per_nft', '0.03'),
        ('max_win_chance', '0.80')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log("✅ Tables ready");
  } catch (err) {
    console.error("❌ Database init failed", err);
    process.exit(1);
  }
}

/* =========================
   PLAYER HELPERS
========================= */

async function createPlayerIfMissing(discordId) {
  await pool.query(
    `
    INSERT INTO players (discord_id)
    VALUES ($1)
    ON CONFLICT (discord_id) DO NOTHING
    `,
    [discordId]
  );
}

async function getPlayer(discordId) {
  await createPlayerIfMissing(discordId);

  const res = await pool.query(
    `SELECT * FROM players WHERE discord_id = $1`,
    [discordId]
  );

  return res.rows[0] || null;
}

async function updateWallet(discordId, address, timestamp) {
  await pool.query(
    `
    UPDATE players
    SET wallet_address = $1,
        last_wallet_change = $2
    WHERE discord_id = $3
    `,
    [address, timestamp, discordId]
  );
}

async function updateNFTCount(discordId, count) {
  await pool.query(
    `
    UPDATE players
    SET nft_count = $1
    WHERE discord_id = $2
    `,
    [count, discordId]
  );
}

/* =========================
   GAMEPLAY TIMERS
========================= */

async function updateLastTrial(discordId) {
  const now = Date.now();

  await pool.query(
    `
    UPDATE players
    SET last_trial = $1,
        first_play_at = CASE
          WHEN first_play_at = 0 THEN $1
          ELSE first_play_at
        END,
        weekly_reset_at = CASE
          WHEN weekly_reset_at = 0 THEN $1
          ELSE weekly_reset_at
        END
    WHERE discord_id = $2
    `,
    [now, discordId]
  );
}

/* =========================
   TOKENS (ACCUMULATE ONLY)
========================= */

async function addTokens(discordId, amount) {
  await pool.query(
    `
    UPDATE players
    SET total_tokens = total_tokens + $1,
        weekly_tokens = weekly_tokens + $1
    WHERE discord_id = $2
    `,
    [amount, discordId]
  );
}

/* =========================
   CLAIM RESET (ONLY AFTER SUCCESS)
========================= */

async function resetWeeklyAfterClaim(discordId) {
  await pool.query(
    `
    UPDATE players
    SET weekly_tokens = 0,
        weekly_reset_at = $1
    WHERE discord_id = $2
    `,
    [Date.now(), discordId]
  );
}

/* =========================
   ADMIN FORCE RESET
========================= */

async function adminResetPlayer(discordId) {
  await pool.query(
    `
    UPDATE players
    SET weekly_tokens = 0,
        total_tokens = 0,
        weekly_reset_at = 0,
        first_play_at = 0,
        last_trial = 0
    WHERE discord_id = $1
    `,
    [discordId]
  );
}

/* =========================
   TRANSACTIONS
========================= */

async function recordTransaction(txId, discordId, amount) {
  await pool.query(
    `
    INSERT INTO transactions (tx_id, discord_id, amount, timestamp)
    VALUES ($1, $2, $3, $4)
    `,
    [txId, discordId, amount, Date.now()]
  );
}

/* =========================
   LEADERBOARD
========================= */

async function getWeeklyLeaderboard(limit = 10) {
  const res = await pool.query(
    `
    SELECT discord_id, weekly_tokens
    FROM players
    WHERE wallet_address IS NOT NULL
      AND weekly_tokens > 0
    ORDER BY weekly_tokens DESC
    LIMIT $1
    `,
    [limit]
  );

  return res.rows;
}

/* =========================
   NFT COLLECTIONS
========================= */

async function addCollection(policyId, name) {
  await pool.query(
    `
    INSERT INTO nft_collections (policy_id, name)
    VALUES ($1, $2)
    ON CONFLICT (policy_id) DO NOTHING
    `,
    [policyId, name]
  );
}

async function removeCollection(policyId) {
  await pool.query(
    `DELETE FROM nft_collections WHERE policy_id = $1`,
    [policyId]
  );
}

async function getCollections() {
  const res = await pool.query(
    `SELECT policy_id, name FROM nft_collections`
  );
  return res.rows;
}

/* =========================
   GAME SETTINGS
========================= */

async function setGameSetting(key, value) {
  await pool.query(
    `
    INSERT INTO game_settings (key, value)
    VALUES ($1, $2)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value
    `,
    [key, String(value)]
  );
}

async function getGameSetting(key) {
  const res = await pool.query(
    `SELECT value FROM game_settings WHERE key = $1`,
    [key]
  );
  return res.rows[0]?.value ?? null;
}

/* =========================
   EXPORT
========================= */

export default {
  pool,
  initDB,

  // players
  getPlayer,
  createPlayerIfMissing,
  updateWallet,
  updateNFTCount,

  // gameplay
  updateLastTrial,

  // rewards
  addTokens,
  resetWeeklyAfterClaim,
  recordTransaction,

  // admin
  adminResetPlayer,

  // leaderboard
  getWeeklyLeaderboard,

  // collections
  addCollection,
  removeCollection,
  getCollections,

  // settings
  setGameSetting,
  getGameSetting
};
