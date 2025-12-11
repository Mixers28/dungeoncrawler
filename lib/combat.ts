// lib/combat.ts
import { MONSTER_MANUAL } from "./rules";

export type CombatResult = {
  playerHp: number;
  monsterHp: number;
  log: string[]; // A list of events to feed the AI
  isMonsterDead: boolean;
  isPlayerDead: boolean;
};

// Returns the state AFTER the turn is resolved
export function resolveCombatRound(
  monsterName: string,
  currentMonsterHp: number,
  currentPlayerHp: number,
  playerAction: string // e.g., "attack", "dodge", "run"
): CombatResult {
  const monsterStats = MONSTER_MANUAL[monsterName];
  if (!monsterStats) throw new Error(`Monster ${monsterName} not found!`);

  let newMonsterHp = currentMonsterHp;
  let newPlayerHp = currentPlayerHp;
  const combatLog: string[] = [];

  // --- 1. PLAYER TURN ---
  // Simple keyword matching for now. 
  // In a real app, you might use AI to categorize the intent first.
  const isPlayerAttacking = /attack|stab|hit|slash|lunge|strike/i.test(playerAction);
  const isPlayerDodging = /dodge|weave|sidestep/i.test(playerAction);

  if (isPlayerAttacking) {
    // Hardcoded player stats for now (Weapon: 1d6+2)
    const hitRoll = Math.floor(Math.random() * 20) + 1 + 4; // d20 + 4 bonus
    const acToHit = monsterStats.ac;

    if (hitRoll >= acToHit) {
      const damage = Math.floor(Math.random() * 6) + 1 + 2; // 1d6 + 2
      newMonsterHp = Math.max(0, newMonsterHp - damage);
      combatLog.push(`PLAYER ATTACK: Rolled ${hitRoll} vs AC ${acToHit}. HIT! Dealt ${damage} damage.`);
    } else {
      combatLog.push(`PLAYER ATTACK: Rolled ${hitRoll} vs AC ${acToHit}. MISS.`);
    }
  } else if (isPlayerDodging) {
    combatLog.push(`PLAYER ACTION: You focus entirely on evading the next attack.`);
  } else {
     // Flavor action (torch, talk, etc) - no damage dealt
     combatLog.push(`PLAYER ACTION: Performed non-combat action: "${playerAction}"`);
  }

  // Check if monster died
  if (newMonsterHp <= 0) {
    return {
      playerHp: newPlayerHp,
      monsterHp: 0,
      log: [...combatLog, "RESULT: The monster has been defeated!"],
      isMonsterDead: true,
      isPlayerDead: false
    };
  }

  // --- 2. MONSTER TURN ---
  // If monster is alive, it attacks back
  let monsterAcPenalty = 0;
  if (isPlayerDodging) monsterAcPenalty = 5; // Advantage on dodge

  const monsterHitRoll = Math.floor(Math.random() * 20) + 1 + monsterStats.attackBonus;
  // Assuming Player AC is 12
  const playerAc = 12 + monsterAcPenalty; 

  if (monsterHitRoll >= playerAc) {
    // Parse damage string "1d4+2"
    const [dice, mod] = monsterStats.damage.split('+');
    const [num, faces] = dice.split('d').map(Number);
    let damage = parseInt(mod || "0");
    for(let i=0; i<num; i++) damage += Math.floor(Math.random() * faces) + 1;

    newPlayerHp = Math.max(0, newPlayerHp - damage);
    combatLog.push(`MONSTER ATTACK: ${monsterStats.name} attacks (Rolled ${monsterHitRoll}). HIT! You take ${damage} damage.`);
  } else {
    combatLog.push(`MONSTER ATTACK: ${monsterStats.name} attacks (Rolled ${monsterHitRoll}). MISS!`);
  }

  return {
    playerHp: newPlayerHp,
    monsterHp: newMonsterHp,
    log: combatLog,
    isMonsterDead: false,
    isPlayerDead: newPlayerHp <= 0
  };
}
