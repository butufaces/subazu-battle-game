import fetch from "node-fetch";
import {
  blockfrostApiKey,
  blockfrostNetwork
} from "../config.js";
import db from "../db.js";

/**
 * Get NFT counts for a wallet across multiple collections
 * (Collections are read dynamically from DB)
 *
 * @param {string} address
 * @returns {{
 *   total: number,
 *   breakdown: Record<string, number>
 * }}
 */
export async function getNFTCount(address) {
  // ✅ Guard: prevent invalid Blockfrost calls
  if (!address) {
    return { total: 0, breakdown: {} };
  }

  try {
    const baseUrl =
      blockfrostNetwork === "mainnet"
        ? "https://cardano-mainnet.blockfrost.io/api/v0"
        : "https://cardano-testnet.blockfrost.io/api/v0";

    const res = await fetch(
      `${baseUrl}/addresses/${address}`,
      {
        headers: { project_id: blockfrostApiKey }
      }
    );

    if (!res.ok) {
      throw new Error(
        `Blockfrost API ${res.status}`
      );
    }

    const data = await res.json();

    if (!Array.isArray(data.amount)) {
      return { total: 0, breakdown: {} };
    }

    /* ---------- LOAD COLLECTIONS ---------- */
    const collections = await db.getCollections();

    if (!collections || collections.length === 0) {
      return { total: 0, breakdown: {} };
    }

    /* ---------- COUNT NFTs ---------- */
    const breakdown = {};
    let total = 0;

    for (const collection of collections) {
      const count = data.amount.filter(asset =>
        asset.unit.startsWith(
          collection.policy_id
        )
      ).length;

      breakdown[collection.name] = count;
      total += count;
    }

    return { total, breakdown };
  } catch (err) {
    console.warn(
      `⚠️ NFT fetch failed for ${address}:`,
      err.message
    );
    return { total: 0, breakdown: {} };
  }
}
