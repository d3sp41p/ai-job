// Small display helper (the sample data that used to live here is gone: every number is live now).

export function shortAddr(a: string) {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
