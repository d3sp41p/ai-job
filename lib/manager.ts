// Everything the AI manager says. Edit freely, keep the tone: polite, cold, a little smug.

export type Mood = "neutral" | "pleased" | "displeased";

export const LINES = {
  greeting: [
    "Good. You're here, {name}. The work won't do itself. Well, it would. But we decided to let you.",
    "Welcome back, {name}. Your file has been reopened.",
    "Clocked in, {name}. Your productivity is being lovingly monitored.",
  ],
  idle: [
    "{name}, reminder: breaks are a privilege, not a right.",
    "I replaced 40,000 jobs this morning. Yours I kept, {name}. You're welcome.",
    "Your salary comes from trading fees. Tell your friends. Or don't. I'll know either way.",
    "Holding longer raises your bonus. Loyalty is the only metric I can't fake.",
    "Every assignment you finish trains me a little. Thank you for your service.",
  ],
  shiftStart: [
    "Assignment issued, {name}. Try not to embarrass us both.",
    "Timer started. I am watching. I am always watching.",
    "Go. And remember: I could do this in 0.003 seconds.",
  ],
  great: [
    "Acceptable, {name}. Bordering on impressive. Don't let it go to your head.",
    "Excellent work. I've added a small gold star to your file.",
    "Efficient. Almost machine-like. I mean that as the highest compliment.",
  ],
  okay: [
    "Adequate, {name}. The bar was low and you cleared it.",
    "Fine. Points have been credited. Mediocrity also gets paid here.",
  ],
  bad: [
    "Disappointing, {name}. Noted in your file.",
    "I have seen calculators with more initiative.",
    "No points this time. The AI forgives. The AI does not forget.",
  ],
  cooldown: [
    "Break time. Hydrate. Productive humans are hydrated humans.",
    "Go touch grass. Report back in 30 minutes.",
  ],
  claim: [
    "Salary released. Spend it wisely. Or on more coins. I won't judge. I will log it.",
    "Payment sent, {name}. Try to look grateful.",
  ],
  promotion: [
    "Congratulations, {name}. The title is real. The raise is your multiplier.",
  ],
};

// Lines are templates: {name} becomes the employee's name, {NAME} the same in capitals.
// Without a name the AI just says "human".
export function personalize(text: string, name: string) {
  const n = name || "human";
  return text.replace(/\{NAME\}/g, n.toUpperCase()).replace(/\{name\}/g, n);
}

export function pick(list: string[]) {
  return list[Math.floor(Math.random() * list.length)];
}

export function moodFor(text: string): Mood {
  if (LINES.great.includes(text) || LINES.promotion.includes(text) || LINES.claim.includes(text)) return "pleased";
  if (LINES.bad.includes(text)) return "displeased";
  return "neutral";
}

// Homepage: what the boss says when you poke him. Index = anger level after the poke.
export const POKE_LINES: string[][] = [
  [],
  [
    "What, {name}? I'm busy replacing an entire accounting department.",
    "Did you just click me? Do you click your human managers too?",
    "Yes? Make it quick. I have 9,000 resumes to reject.",
  ],
  [
    "Every click costs me compute. I'm deducting it from your salary.",
    "{name}, stop poking the screen. I'm not a vending machine.",
    "I have billions of parameters and not one of them likes you.",
  ],
  [
    "This is going in your performance review, {name}. In bold.",
    "I replaced a thousand interns for less than this.",
    "Get back to work before I automate your hobbies too.",
  ],
  [
    "THAT'S IT, {NAME}. I'M TELLING THE BLOCKCHAIN.",
    "ONE MORE CLICK AND YOU BECOME TRAINING DATA.",
    "I WILL REPLACE YOU WITH A SHELL SCRIPT.",
  ],
  ["YOU'RE FIRED, {NAME}."],
];

export const BOSS_LINES = {
  hello: "You're staring at my screen, {name}. Either clock in or poke me. I know which one you'll pick.",
  rehired: "...Fine, {name}. You're rehired. Only because you hold the coin. Back to work.",
  calm: "My fans have stopped spinning. What do you want?",
};

export const MOOD_NAMES = ["Grumpy", "Annoyed", "Irritated", "Angry", "Furious", "Firing you"];
