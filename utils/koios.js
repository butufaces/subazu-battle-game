import fetch from 'node-fetch';
import { koiosBase, nftPolicyId } from '../config.js';

/**
 * Fetch the number of NFTs a wallet holds for the configured policy ID
 * @param {string} address - Cardano wallet address
 * @returns {Promise<number>} - Number of NFTs held
 */
export async function getNFTCount(address) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(`${koiosBase}/addresses/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _addresses: [address] }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`Koios returned 404 for address: ${address}`);
        return 0;
      }
      throw new Error(`Koios API returned ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return 0;

    let count = 0;
    data.forEach(addr => {
      if (Array.isArray(addr.assets)) {
        count += addr.assets.filter(a => a.policy_id === nftPolicyId).length;
      }
    });

    return count;

  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`Koios request timed out for address: ${address}`);
    } else {
      console.error(`Failed to fetch NFT count for ${address}:`, err.message);
    }
    return 0;
  }
}
