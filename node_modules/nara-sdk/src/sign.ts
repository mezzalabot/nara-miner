/**
 * Ed25519 request signing for Nara API endpoints (e.g. model-hub).
 *
 * All query params (except `sign`) are sorted alphabetically by key,
 * joined as "key=value&key=value", and signed with Ed25519.
 */

import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

/**
 * Build the message to sign from query parameters.
 * Sorts all params (excluding "sign") alphabetically by key,
 * joins as "key=value&key=value".
 */
function buildSignMessage(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

/**
 * Sign query parameters with a wallet keypair.
 *
 * @param wallet - Keypair used to sign
 * @param params - All query params to include (excluding "sign")
 * @returns The params with "address", "ts", and "sign" added/set
 */
export function signParams(
  wallet: Keypair,
  params: Record<string, string> = {}
): Record<string, string> {
  const allParams: Record<string, string> = {
    ...params,
    address: wallet.publicKey.toBase58(),
    ts: Math.floor(Date.now() / 1000).toString(),
  };
  const message = buildSignMessage(allParams);
  const signature = nacl.sign.detached(
    new TextEncoder().encode(message),
    wallet.secretKey
  );
  allParams.sign = bs58.encode(signature);
  return allParams;
}

/**
 * Build a signed URL by appending all signed query parameters.
 *
 * @param baseUrl - Base URL (e.g. "https://api.nara.xyz/model-hub-api/user/info")
 * @param wallet  - Keypair used to sign
 * @param params  - Additional query params (e.g. { tx: "3k2P7n..." })
 * @returns Full URL with all params + address, ts, sign
 */
export function signUrl(
  baseUrl: string,
  wallet: Keypair,
  params?: Record<string, string>
): string {
  const signed = signParams(wallet, params);
  const url = new URL(baseUrl);
  for (const [k, v] of Object.entries(signed)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}
