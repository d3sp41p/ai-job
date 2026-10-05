// Who works under which address, from which device. Server only.

import { MAX_ADDRESSES_PER_DEVICE, MAX_ADDRESSES_PER_IP } from "@/lib/config";
import { insert, select } from "./db";
import { ipHash, type Session } from "./session";

export type LockState = { locked: boolean; lockedHere: boolean };

export async function lockState(address: string, deviceId: string): Promise<LockState> {
  const rows = await select("address_locks", { columns: "device_id", filters: { address: `eq.${address}` } });
  return { locked: rows.length > 0, lockedHere: rows.some((r: any) => r.device_id === deviceId) };
}

export class WorkerError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
}

/**
 * Checks before a device may work under `address`:
 * not banned, not locked to other devices, device and network address limits.
 * `proven` = the owner just signed with this address (Lock flow): skips the lock check.
 */
export async function assignAddress(s: Session, address: string, opts: { proven?: boolean; name?: string | null } = {}) {
  const [w] = await select("wallets", { columns: "banned", filters: { address: `eq.${address}` }, limit: 1 });
  if (w?.banned) throw new WorkerError("This address has been let go. Contact HR (you can't).", "banned", 403);

  if (!opts.proven) {
    const lock = await lockState(address, s.d);
    if (lock.locked && !lock.lockedHere) {
      throw new WorkerError(
        "This address is locked to another device. Sign with the wallet that owns it to work from here.",
        "locked_elsewhere",
        409
      );
    }
  }

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const ip = await ipHash();
  const [byDevice, byIp] = await Promise.all([
    select("device_addresses", { columns: "address", filters: { device_id: `eq.${s.d}`, used_at: `gte.${since}` }, limit: 200 }),
    select("device_addresses", { columns: "address", filters: { ip_hash: `eq.${ip}`, used_at: `gte.${since}` }, limit: 500 }),
  ]);
  const devSet = new Set(byDevice.map((r: any) => r.address));
  const ipSet = new Set(byIp.map((r: any) => r.address));
  if (!devSet.has(address) && devSet.size >= MAX_ADDRESSES_PER_DEVICE) {
    throw new WorkerError(
      `One device can work for at most ${MAX_ADDRESSES_PER_DEVICE} addresses a day. Come back tomorrow.`,
      "device_limit",
      429
    );
  }
  if (!ipSet.has(address) && ipSet.size >= MAX_ADDRESSES_PER_IP) {
    throw new WorkerError("Too many different addresses from this network today. Come back tomorrow.", "ip_limit", 429);
  }

  const wallet: Record<string, unknown> = { address };
  if (opts.name !== undefined) wallet.display_name = opts.name;
  await insert("wallets", wallet, "address");
  await insert("device_addresses", { device_id: s.d, address, ip_hash: ip });
}
