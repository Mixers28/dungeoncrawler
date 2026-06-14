import { parseActionIntentWithKnown, type ParsedIntent } from '../5e/intents';
import { clericSpellsByName, wizardSpellsByName } from '../5e/reference';
import { classifyStunt, type ClassifiedStunt } from '../stunts';
import type { GameState } from './state';

export type CoreActionIntent = 'attack' | 'defend' | 'run' | 'other';

export type TradeIntent = { type: 'openShop' | 'buy' | 'sell'; itemName?: string };

export interface GameIntent {
  userAction: string;
  parsedIntent: ParsedIntent;
  actionIntent: CoreActionIntent;
  tradeIntent: TradeIntent | null;
  stunt: ClassifiedStunt | null;
}

function parseTradeIntent(userAction: string): TradeIntent | null {
  const text = userAction.trim().toLowerCase();
  if (text.includes('talk to trader') || text.includes('open shop') || text.includes('trade')) {
    return { type: 'openShop' };
  }
  if (text.startsWith('buy ')) {
    return { type: 'buy', itemName: text.replace(/^buy\s+/, '') };
  }
  if (text.startsWith('sell ')) {
    return { type: 'sell', itemName: text.replace(/^sell\s+/, '') };
  }
  return null;
}

export function parseIntent(userAction: string, state: GameState): GameIntent {
  const classKey = (state.character?.class || 'fighter').toLowerCase();
  const spellCatalog = classKey === 'cleric' ? clericSpellsByName : wizardSpellsByName;
  const parsedIntent = parseActionIntentWithKnown(
    userAction,
    state.knownSpells || [],
    Object.keys(spellCatalog)
  );

  const actionIntent: CoreActionIntent =
    parsedIntent.type === 'attack' || parsedIntent.type === 'castAbility'
      ? 'attack'
      : parsedIntent.type === 'defend'
      ? 'defend'
      : parsedIntent.type === 'run'
      ? 'run'
      : 'other';

  return {
    userAction,
    parsedIntent,
    actionIntent,
    tradeIntent: parseTradeIntent(userAction),
    stunt: classifyStunt(userAction),
  };
}
