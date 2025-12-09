// lib/rules.ts

export type MonsterStatBlock = {
  name: string;
  hp: number;
  ac: number;
  attackBonus: number;
  damage: string;
  desc: string;
};

export const MONSTER_MANUAL: Record<string, MonsterStatBlock> = {
  "Giant Rat": {
    name: "Giant Rat",
    hp: 7,
    ac: 12,
    attackBonus: 4,
    damage: "1d4+2",
    desc: "A diseased rodent the size of a dog.",
  },
  "Skeleton": {
    name: "Skeleton",
    hp: 13,
    ac: 13,
    attackBonus: 4,
    damage: "1d6+2",
    desc: "Animated bones holding a rusted scrap of iron.",
  },
  "Dire Wolf": {
    name: "Dire Wolf",
    hp: 37,
    ac: 14,
    attackBonus: 5,
    damage: "2d6+3",
    desc: "A massive feral wolf with eyes like burning coals.",
  },
  "Floating Sword": {
    name: "Floating Sword",
    hp: 17,
    ac: 15,
    attackBonus: 6,
    damage: "1d8+1",
    desc: "A spectral weapon animated by a vengeful spirit.",
  },
  "Green Slime": {
    name: "Green Slime",
    hp: 22,
    ac: 8,
    attackBonus: 3,
    damage: "1d4+1d6",
    desc: "A caustic puddle of sentient ooze.",
  },
  // Added to prevent runtime error in Act 2
  "Iron King": {
    name: "Iron King",
    hp: 50,
    ac: 16,
    attackBonus: 7,
    damage: "1d10+4",
    desc: "The ghostly remnant of a tyrant, encased in spectral plate.",
  }
};

export const WEAPON_TABLE: Record<string, string> = {
  "Rusty Dagger": "1d4",
  "Longsword": "1d8",
  "Fists": "1",
};

export const STORY_ACTS = {
  0: {
    name: "The Awakening",
    goal: "Find the 'Iron Key' to unlock the inner sanctum.",
    boss: "Giant Rat",
    clue: "The rats seem to be guarding something shiny in the debris.",
  },
  1: {
    name: "The Deep Descent",
    goal: "Locate the 'Cursed Crown' in the armory.",
    boss: "Floating Sword",
    clue: "The spirits whisper of a crown left on a throne of swords.",
  },
  2: {
    name: "The King's Fall",
    goal: "Destroy the 'Iron King's Ghost'.",
    boss: "Iron King",
    clue: "The throne room is ahead. The air is freezing.",
  }
};

export const KEY_ITEMS = ["Iron Key", "Cursed Crown"];
