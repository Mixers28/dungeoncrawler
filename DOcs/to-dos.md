# Task: Wire D&D 5e JSON data into the Accountant for abilities, skills & actions

## High-level goal

Refactor the **Accountant** logic (app/actions.ts and related helpers) so that:

1. **All abilities, skills, weapons, armor, and basic actions are driven from the existing 5e JSON data** under `data/5e/*.json`, instead of being ad-hoc or implicitly handled by the Narrator.
2. The **Accountant is the single source of truth** for:
   - what a given class can do,
   - what abilities exist and what they cost,
   - how much damage they deal, and
   - whether an action like “cast fireball on skeleton” is legal, and what it does.
3. The **Narrator remains flavor-only** and never invents:
   - new abilities,
   - new weapons/armor,
   - or any mechanical numbers.

The end result: a “reference sheet” layer built from `data/5e` that the Accountant uses to resolve actions and build factual logs.

---

## Existing context

- This is the **Dungeon Portal** project.
- The central logic lives in `app/actions.ts`.
  - We already have a `GameState` Zod schema, `hydrateState`, `_updateGameState`, and `processTurn`.
  - `processTurn` now:
    - calls `_updateGameState` to get a **factual `eventSummary` + `mode`**,  
    - appends a `LogEntry` with `summary` to `state.log`, and
    - optionally calls the **Narrator** LLM to generate a short `flavor` string, which is attached to the last log entry.
- There is an existing `data/5e` folder containing JSON files for:
  - **abilities / spells**
  - **armor**
  - **basic actions**
  - **skills**
  - **weapons**
  Each JSON entry includes at least: **name, damage, cost, requirements, usage details**, etc.

We want to use this 5e data as a **canonical reference sheet** for the Accountant.

---

## Requirements

### 1. Create a typed 5e reference layer

**Files to touch / add (suggested):**

- `data/5e/*.json` *(already exists — read only)*
- New TS helper: `lib/5e/reference.ts` (or similar)
- Update `app/actions.ts` to import from this helper

**Steps:**

1. Inspect the structure of the 5e JSON files in `data/5e/`.
   - Identify the schema for:
     - abilities/spells
     - weapons
     - armor
     - skills
     - basic actions

2. In `lib/5e/reference.ts` (or similar), create **TypeScript types** that mirror these JSON structures, e.g.:

   - `AbilityDef`
   - `WeaponDef`
   - `ArmorDef`
   - `SkillDef`
   - `BasicActionDef`

3. Implement loader functions that:
   - import the JSON,
   - validate them (optional but preferred with Zod), and
   - expose **lookup maps** keyed by ID or name, e.g.:

   ```ts
   export const abilitiesById: Record<string, AbilityDef> = { ... };
   export const abilitiesByName: Record<string, AbilityDef> = { ... };

   export const weaponsByName: Record<string, WeaponDef> = { ... };
   // etc.

    Where the JSON contains:

        damage dice,

        usage type (e.g. action / bonus action),

        resource cost (spell slots, charges),

        class requirements,

        level requirements,
        expose those fields directly on the TypeScript types so the Accountant can act on them.

2. Class → skills/abilities mapping

We already have player classes defined somewhere in the code and/or data.

    Create a helper mapping from the player’s class (or classKey in GameState) to the relevant:

        skills (from data/5e skills JSON),

        abilities/spells the class can use (from abilities JSON),

        weapon/armor proficiencies (if this data exists in JSON).

    Example shape:

    export interface ClassReference {
      key: string;
      name: string;
      allowedAbilities: string[];  // ability IDs
      allowedWeapons: string[];    // names or IDs
      allowedArmor: string[];      // names or IDs
      skills: string[];            // skill IDs
    }

    export const classReferenceByKey: Record<string, ClassReference> = { ... };

    Use the JSON data to populate these lists as much as possible, instead of hardcoding them.

3. Structured action intent using 5e reference data

We already have some form of getActionIntent(userAction: string) that returns an enum or similar for 'attack', 'look', 'checkSheet', etc.

Refine/extend it to include ability casting, using the 5e reference:

    Introduce structured intents like:

    type ActionIntent =
      | { type: 'castAbility'; abilityId: string; targetName?: string }
      | { type: 'attack'; targetName?: string; weaponName?: string }
      | { type: 'look' }
      | { type: 'checkSheet' }
      | { type: 'move'; direction?: string }
      | { type: 'unknown' };

    When parsing user text, try to match ability names from abilitiesByName:

        cast fireball on skeleton → { type: 'castAbility', abilityId: 'fireball', targetName: 'skeleton' }

        use second wind → { type: 'castAbility', abilityId: 'second_wind' }

    Use the 5e reference names and aliases instead of hardcoded string comparisons wherever possible.

4. Ability resolution in the Accountant (no Narrator involved)

In _updateGameState(currentState, userAction), we need to:

    Call getActionIntent(userAction) to get a structured intent.

    When intent.type === 'castAbility':

        Look up the ability via abilitiesById[intent.abilityId].

        Check class and requirement constraints based on:

            classReferenceByKey[state.class].allowedAbilities

            any level requirements or other prerequisites from the JSON.

        If not allowed:

            Set eventSummary to something factual like:

                You attempt to use ${ability.name}, but your training does not permit it.

        If allowed:

            Resolve targeting:

                Find the target entity (e.g. skeleton) from newState.entities by name.

            Apply mechanics from the JSON:

                Use ability.damageDice to call the existing rollDice helper and deal damage.

                Deduct any resource cost (e.g. spell slot) from GameState if/when we model that.

            Update GameState accordingly (HP, conditions, etc.).

            Construct a factual eventSummary that describes what happened in plain language:

            eventSummary = `You cast ${ability.name} on the ${target.name}, dealing ${damage} ${ability.damageType} damage.`;

    The Narrator MUST NOT be consulted to resolve abilities or decide damage. It only gets eventSummary and decorates it with 1 short flavor line.

5. “Check skills” / “check inventory” outputs from Accountant only

When the player types things like check skills, check abilities, or inventory:

    The intent should be 'checkSheet' (or similar) and no Narrator call is required.

    The Accountant should build a factual eventSummary using the 5e reference:

        Skills:

            Use the class-to-skill mapping and/or actual GameState skills.

        Abilities:

            List known/available abilities for that class at that level.

        Equipment:

            Use state.inventory, state.weapons, state.armor combined with the JSON definitions where needed.

    Example eventSummary:

        You are trained in Athletics and Perception. You are currently equipped with a longsword and leather armor.

    For this mode, do not call the Narrator or only call it with a generic, non-factual line if desired (e.g. “You quickly take stock of your strengths and tools.”).

6. Do NOT let the Narrator invent abilities or stats

Ensure the existing Narrator system prompt is consistent with this new design:

    It must clearly state:

        The Narrator cannot:

            list skills,

            list inventory,

            enumerate abilities,

            mention damage amounts, HP, or dice.

        The Narrator only adds a short color line beneath the factual log entry produced by the Accountant.

    If necessary, adjust the Narrator prompt so that abilities, weapons, and armor are only referenced in a vague, atmospheric way, not as a canonical list.

Implementation notes

    Be careful not to break the existing GameState schema.

        If new fields are needed (e.g. resources for spell slots), add them with sensible defaults via Zod.

    Keep all game rules and mechanics deterministic and testable:

        Given a fixed GameState and userAction, _updateGameState should always produce the same newState and eventSummary.

    Favor pure functions for reference lookups and intent parsing, so we can easily unit test them later.

Acceptance criteria

    Given a class that knows fireball in the 5e data:

        Typing cast fireball on skeleton:

            reduces skeleton HP in GameState according to fireball’s damage dice from JSON,

            produces a factual log entry (summary) describing the action and damage,

            and (optionally) a short flavor line from the Narrator that does not introduce new mechanics.

    If the class is not allowed to cast fireball:

        The action is rejected with a clear factual summary explaining why.

    Skills / abilities / inventory checks:

        Produce deterministic, Accountant-generated summaries based on the 5e JSON + current GameState,

        no longer rely on the Narrator to list gear or skills.

    The Narrator:

        Never lists full weapon/armor/ability catalogs,

        Never reports HP or damage numbers,

        Only produces 1 short flavor sentence per event (when enabled),

        And can be disabled entirely without breaking mechanics.

Please perform the implementation, update app/actions.ts and any necessary helper files, and keep the changes well-structured and commented so we can iterate on the rules later.