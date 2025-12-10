export const ARCHETYPES = {
  fighter: {
    label: "Fighter",
    acBonus: 2,
    hpBonus: 4,
    startingWeapon: "Longsword",
    startingArmor: "Leather",
    background: "Soldier",
  },
  rogue: {
    label: "Rogue",
    acBonus: 1,
    hpBonus: 2,
    startingWeapon: "Dagger",
    startingArmor: "Leather",
    background: "Urchin",
  },
  cleric: {
    label: "Cleric",
    acBonus: 1,
    hpBonus: 3,
    startingWeapon: "Mace",
    startingArmor: "Scale Mail",
    background: "Acolyte",
  },
  wizard: {
    label: "Wizard",
    acBonus: 0,
    hpBonus: 0,
    startingWeapon: "Dagger",
    startingArmor: undefined,
    background: "Sage",
  },
};

export type ArchetypeKey = keyof typeof ARCHETYPES;
