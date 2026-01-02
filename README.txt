CARDANO DISCORD GAME BOT (Node 18 + ES Modules)

====================
WHAT THIS BOT DOES
====================
- Players register a Cardano wallet with /wallet
- /trial runs a 3-round battle against the bot
- Players MUST hold at least 1 NFT from your policy to play
- More NFTs = higher win probability (capped)
- If player wins 2/3: gets base reward
- If player wins 3/3: gets 2x reward
- Rewards are sent instantly as a native token using Blockfrost + Cardano Serialization Lib (no cardano-cli)

====================
REQUIREMENTS
====================
1) Node.js: 18.20.x (recommended)
2) Windows/Mac/Linux: works (Windows requires the ES module file URL fix already applied)

====================
INSTALL
====================
1) In the project folder, install dependencies:

   npm install

2) Create a .env file in the project root:

   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_application_id

   BLOCKFROST_API_KEY=your_blockfrost_project_id
   BLOCKFROST_NETWORK=mainnet

   # OPTIONAL tuning
   BASE_WIN_CHANCE=0.25
   WEIGHT_PER_NFT=0.03
   MAX_WIN_CHANCE=0.60
   COOLDOWN_HOURS=0.0833
   BASE_REWARD_AMOUNT=10

   # Treasury
   TREASURY_WALLET_ADDRESS=addr1...
   TREASURY_SIGNING_KEY=./payment.skey

3) Edit config.js:
   - nftPolicyId: policy ID for the required NFT collection
   - rewardToken.unit: POLICY_ID(56 hex) + ASSET_NAME_HEX
     Example:
       policy: 0123...abcd (56 hex chars)
       asset name: MYTOKEN -> hex: 4d59544f4b454e
       unit = 0123...abcd4d59544f4b454e

====================
TREASURY SIGNING KEY NOTE
====================
This bot signs transactions locally. That means your treasury payment.skey is used.
Keep it private. Do NOT commit it to GitHub.

If you created the signing key using cardano-cli:
  cardano-cli address key-gen --signing-key-file payment.skey --verification-key-file payment.vkey

Then place payment.skey in the project root (or set TREASURY_SIGNING_KEY in .env).

====================
RUN
====================
Start the bot:

   npm start

You should see:
   ✅ Slash commands registered successfully

====================
COMMANDS
====================
/wallet <address>      Register or update your Cardano wallet (24h change cooldown)
/trial                 Play 3-round trial battle (public battle messages; NFT count/probability sent by DM)
/profile               View your profile (tokens, NFT count, cooldown)
/leaderboard           Top players by total tokens won
/boss                  Shows a random “world boss” card
/help                  Command menu

ADMIN COMMANDS (Admins only)
---------------------------
/admin-setcooldown <hours> Set cooldown hours (0.0833 = ~5 minutes)
/admin-setwin <value>      Set base win chance (0.01 - 0.99)

====================
TROUBLESHOOTING
====================
1) If commands don’t load:
   - Make sure package.json has: "type": "module"
   - Make sure every command file uses ES module exports (export const data, export async function execute)

2) If /trial fails to DM the player:
   - Player has DMs closed. The game still runs; only the private info can’t be delivered.

3) If reward sending fails:
   - Treasury wallet must have ADA for fees and min-ADA
   - rewardToken.unit must be correct (policy+assetNameHex)
   - Blockfrost key/network must match your chain
