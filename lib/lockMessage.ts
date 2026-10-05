// The exact text a worker signs to lock their address. Built the same way in the browser
// (to show and sign) and on the server (to verify). Plain text, no transaction.

export function lockMessage(p: { address: string; device: string; nonce: string; expires: string }) {
  return [
    "AI Gave Me a Job: lock my payroll address",
    "",
    `Address: ${p.address}`,
    `Device: ${p.device.slice(0, 8)}`,
    `Nonce: ${p.nonce}`,
    `Expires: ${p.expires}`,
    "",
    "Signing is free and does not give access to your funds. It is not a transaction.",
  ].join("\n");
}
