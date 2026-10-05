import type { Difficulty } from "./config";

export type GameDef = {
  id: string;
  name: string;
  difficulty: Difficulty;
  brief: string; // what the AI boss says before the shift
};

// 15 jobs the AI doesn't want to do itself. 5 per shift type.
export const GAMES: GameDef[] = [
  // Easy: Part-time
  { id: "take-out-trash", name: "Take Out the Trash", difficulty: "easy", brief: "The office bin is full. Everything goes in. Except the coin. That is a test." },
  { id: "swipe-badge", name: "Swipe Your Badge", difficulty: "easy", brief: "Clock in at the reader. It is old and sensitive. Much like your manager." },
  { id: "refill-coffee", name: "Refill the Coffee", difficulty: "easy", brief: "Three cups for the board meeting. Fill each one to the line. Not a drop more." },
  { id: "sort-mail", name: "Sort the Mail", difficulty: "easy", brief: "The mailroom robot quit. Put every letter in the right tray." },
  { id: "unjam-printer", name: "Unjam the Printer", difficulty: "easy", brief: "The printer is jammed again. Pull the paper out the way it came. Gently." },
  // Medium: Full-time
  { id: "fix-wiring", name: "Fix the Wiring", difficulty: "medium", brief: "Someone unplugged the server room. Reconnect every wire to its socket." },
  { id: "calibrate-arm", name: "Calibrate the Robot Arm", difficulty: "medium", brief: "Lock each joint of the robot arm in the green zone. It punches things when it's off." },
  { id: "pack-orders", name: "Pack the Orders", difficulty: "medium", brief: "Three orders, three boxes. Pack exactly what the slip says." },
  { id: "support-calls", name: "Answer Support Calls", difficulty: "medium", brief: "The chatbot is on a break. Answer the customers like a helpful human would." },
  { id: "assembly-line", name: "Run the Assembly Line", difficulty: "medium", brief: "Parts are coming down the belt. Sort them before they fall off. The belt speeds up." },
  // Hard: Overtime
  { id: "circuit-board", name: "Repair the Circuit Board", difficulty: "hard", brief: "Rotate the traces until power reaches the chip. Do not lick the board." },
  { id: "data-entry", name: "Data Entry", difficulty: "hard", brief: "The OCR is down. Type this invoice into the system. Every character counts." },
  { id: "night-security", name: "Night Shift Security", difficulty: "hard", brief: "Watch the cameras. Robots are stealing coins. Cats are allowed. So is the janitor." },
  { id: "forklift", name: "Forklift Delivery", difficulty: "hard", brief: "Drive to the pallet and bring it back to the dock. Every bump is deducted from your dignity." },
  { id: "balance-books", name: "Balance the Books", difficulty: "hard", brief: "I replaced the accountants. Now check my numbers. Find the rows that don't match." },
];

export function pickGame(difficulty: Difficulty): GameDef {
  // In production the server picks the game and its seed.
  const pool = GAMES.filter((g) => g.difficulty === difficulty);
  return pool[Math.floor(Math.random() * pool.length)];
}
