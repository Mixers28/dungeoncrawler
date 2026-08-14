import type { GameState, RollEvent, TurnEvent } from '../../game-schema';
import type { TurnContext } from '../turn-context';

/**
 * Mutable carrier for everything a single turn accumulates while it resolves.
 *
 * `_updateGameState` used to keep these as function-scope locals, which is what
 * made its sections impossible to extract. Every field here is an object or
 * array, so a section that mutates one through the draft mutates the same value
 * the caller holds — extraction stays behaviour-preserving.
 */
export type TurnDraft = {
  /** The turn's working copy of game state. Sections mutate its properties. */
  state: GameState;
  /** Actor/monster accessor shared by the turn-context helpers. */
  context: TurnContext;
  /** Structured events the UI renders (loot reveals, coins, damage). */
  events: TurnEvent[];
  /** Factual sentences assembled into the log entry summary. */
  summary: string[];
  /** Dice results surfaced in the roll log. */
  rolls: RollEvent[];
};
