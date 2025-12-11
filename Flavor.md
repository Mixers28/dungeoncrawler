# Task: Implement AI flavor-only Narrator for searches, looting, investigations, etc.

## High-level goal

We’re using a **hybrid system** in Dungeon Portal:

- The **Accountant** (TypeScript) is 100% responsible for:
  - All mechanics (hits, damage, HP, loot, skills, abilities).
  - The canonical **factual log** (`LogEntry.summary`).
- The **Narrator AI** is **flavor-only**:
  - It adds ONE short atmospheric sentence under the factual log.
  - It never invents mechanics, numbers, items, exits, or NPCs.

**Goal of this task:**

1. Ensure that **SEARCH / LOOT / INVESTIGATE / ROOM_INTRO / GENERAL_INTERACTION / COMBAT_FOCUS** actions get a **short DM flavor line**.
2. Keep **SHEET / “check skills / inventory”** actions factual-only (no Narrator).
3. Keep the Narrator strictly on a leash: it cannot change game state and cannot add loot, damage, or NPCs.

All work is in the existing Dungeon Portal codebase, primarily `app/actions.ts` (and optionally small helpers).

---

## Existing context

- We already have:
  - A `GameState` with a `log: LogEntry[]` (each entry has `summary` and optional `flavor`).
  - `_updateGameState(currentState, userAction)` that:
    - Resolves mechanics and returns `newState`, `roomDesc`, and a **factual `eventSummary`**.
  - `processTurn(currentState, userAction)` that:
    - Appends a `LogEntry` with the factual `summary` to `newState.log`.
    - Optionally calls the Narrator LLM to add `flavor`.

We now want to refine:

1. The **NarrationMode** values and when we use AI.
2. The **Narrator system prompt** and `generateFlavorLine` function.
3. The wiring in `processTurn`.

---

## Requirements

### 1. Define `NarrationMode` and when to use AI

In `app/actions.ts` (or a nearby file where `_updateGameState` lives):

1. Define a `NarrationMode` type that includes the actions we care about:

   ```ts
   type NarrationMode =
     | 'ROOM_INTRO'
     | 'COMBAT_FOCUS'
     | 'GENERAL_INTERACTION'
     | 'SEARCH'
     | 'INVESTIGATE'
     | 'LOOT'
     | 'SHEET'; // skills / inventory, etc.

    Ensure _updateGameState returns this mode along with newState and eventSummary:

interface UpdateResult {
  newState: GameState;
  roomDesc: string;
  eventSummary: string;
  mode: NarrationMode;
}

Inside _updateGameState, set mode based on the parsed intent, for example:

    "look around" → mode = 'ROOM_INTRO'

    "search the body", "search corpse" → mode = 'SEARCH'

    "loot chest", "loot the body" → mode = 'LOOT'

    "inspect altar", "examine statue" → mode = 'INVESTIGATE'

    "check skills", "inventory" → mode = 'SHEET'

    Attacks / abilities → mode = 'COMBAT_FOCUS'

    Other misc actions → mode = 'GENERAL_INTERACTION'

Add a helper shouldUseNarrator(mode: NarrationMode): boolean:

    function shouldUseNarrator(mode: NarrationMode): boolean {
      switch (mode) {
        case 'SEARCH':
        case 'INVESTIGATE':
        case 'LOOT':
        case 'ROOM_INTRO':
        case 'GENERAL_INTERACTION':
        case 'COMBAT_FOCUS':
          return true;   // we want flavor DM for these
        case 'SHEET':
        default:
          return false;  // no flavor for skills/inventory/meta
      }
    }

2. Ensure the Accountant produces good factual summaries for these modes

For each relevant intent inside _updateGameState, ensure eventSummary is factual and self-contained:

    SEARCH / LOOT examples:

if (intent.type === 'searchBody') {
  mode = 'SEARCH';

  if (alreadySearched) {
    eventSummary = `You search the corpse again but find nothing new.`;
  } else if (lootItems.length === 0) {
    eventSummary = `You search the corpse carefully but find nothing of value.`;
  } else {
    const names = lootItems.map(i => i.name).join(', ');
    eventSummary = `You search the corpse and take: ${names}.`;
  }
}

if (intent.type === 'lootChest') {
  mode = 'LOOT';
  // similar pattern
}

INVESTIGATE example:

    if (intent.type === 'inspectObject') {
      mode = 'INVESTIGATE';
      eventSummary = `You inspect the ${objectName} closely.`;
      // any factual discoveries go here
    }

    ROOM_INTRO / GENERAL_INTERACTION / COMBAT_FOCUS:

        Keep using your existing patterns (just make sure mode is set correctly and eventSummary is factual).

Remember: these summaries must not rely on the Narrator. They should fully describe what actually happened in mechanical terms.
3. Implement generateFlavorLine and the Narrator system prompt

In app/actions.ts (or a small helper module), implement a Narrator flavor generator:

    Define a NARRATOR_SYSTEM string that enforces flavor-only behavior:

    const NARRATOR_SYSTEM = `

You are THE NARRATOR for a dark, minimalist dungeon-crawl called "Dungeon Portal".

You never change game state. You only add ONE short atmospheric sentence beneath a factual log entry.

=== ROLE ===

    INPUT: MODE + EVENT_SUMMARY + LOCATION_DESCRIPTION (+ optional INVENTORY_SUMMARY).

    OUTPUT: ONE sentence (max ~30 words) of mood and sensory detail.

    Do NOT repeat the factual log verbatim; you only add flavor.

=== HARD RULES ===

    You may NOT invent:

        new items, gold, weapons, armor, or loot,

        new NPCs, taverns, shops, or exits,

        new abilities, spells, or skills,

        any numbers (HP, damage, gold, distances, DCs, dice).

    For SEARCH / LOOT:

        You may describe dust, blood, smell, texture, emptiness, or the feel of the items found.

        You must NOT add extra loot beyond what EVENT_SUMMARY says.

    For INVESTIGATE:

        You may hint at age, mood, or subtle details of existing objects,

        but must NOT reveal new secret doors, puzzles, or mechanics not present in EVENT_SUMMARY.

    For ROOM_INTRO and GENERAL_INTERACTION:

        Focus on the environment, atmosphere, and immediate emotional tone.

    For COMBAT_FOCUS:

        Emphasize danger, motion, and pain, not mechanics.

"The Iron Gate" is an exterior iron gate in cold stone fortifications, not a tavern or inn; do NOT describe bars, bartenders, patrons, or rooms for rent there.

=== STYLE ===

    Tone: gritty, grounded dark fantasy; one or two sharp details.

    Maximum one sentence, ~30 words.

    Do NOT end with questions like "What do you do next?".
    `;

    Implement a generateFlavorLine helper:

    interface FlavorInput {
      mode: NarrationMode;
      location: string;
      locationDescription: string;
      eventSummary: string;
      inventorySummary?: string;
    }

    async function generateFlavorLine({
      mode,
      location,
      locationDescription,
      eventSummary,
      inventorySummary,
    }: FlavorInput): Promise<string | null> {
      const prompt = `

MODE: ${mode}
LOCATION: ${location}
LOCATION_DESCRIPTION:
${locationDescription}

EVENT_SUMMARY:
${eventSummary}

INVENTORY_SUMMARY:
${inventorySummary ?? 'Not relevant.'}
`.trim();

 const { text } = await generateText({
   model: groq(MODEL_NARRATOR),
   temperature: 0.4,
   system: NARRATOR_SYSTEM,
   prompt,
 });

 const flavor = text.trim();

 // Basic guardrails
 if (!flavor) return null;
 if (flavor.split(/\s+/).length > 40) return null;

 return flavor;

}


### 4. Wire the Narrator into `processTurn` using `shouldUseNarrator`

In `processTurn(currentState, userAction)`:

1. After `_updateGameState` and appending the factual log entry:

- Assume we already have:

  ```ts
  const { newState, roomDesc, eventSummary, mode } =
    _updateGameState(currentState, userAction);

  const logEntry: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: mode === 'COMBAT_FOCUS' ? 'combat'
         : mode === 'SHEET' ? 'sheet'
         : 'exploration',
    summary: eventSummary,
  };

  newState.log = [...newState.log, logEntry].slice(-50);
  ```

- Save this state first (before Narrator) so mechanics are never lost.

2. Then, if `shouldUseNarrator(mode)` returns true, call `generateFlavorLine`:

```ts
const locationDescription =
  newState.roomRegistry[newState.location]?.description ??
  'A bleak, undefined space.';

const inventorySummary = buildInventorySummary(newState); // create helper that returns a short one-line summary like "longsword and leather armor" or null

let flavor: string | null = null;
if (shouldUseNarrator(mode)) {
  try {
    flavor = await generateFlavorLine({
      mode,
      location: newState.location,
      locationDescription,
      eventSummary,
      inventorySummary,
    });
  } catch (err) {
    console.error('Narrator failed:', err);
  }
}

    If flavor is non-null, attach it to the last log entry and persist again:

if (flavor) {
  const lastIndex = newState.log.length - 1;
  if (lastIndex >= 0) {
    newState.log[lastIndex] = {
      ...newState.log[lastIndex],
      flavor,
    };
  }

  await supabase
    .from('saved_games')
    .upsert(
      { user_id: user.id, game_state: newState },
      { onConflict: 'user_id' }
    );
} else {
  // Still persist at least once earlier in the function for mechanics;
  // make sure we don't lose state if Narrator fails.
}

Ensure that SHEET mode never calls the Narrator (this should already be handled by shouldUseNarrator).