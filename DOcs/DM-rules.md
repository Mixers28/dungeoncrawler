---
name: dm-rules
description: Dungeon Portal DM rules and adjudication guidelines
---

# Dungeon Portal DM Rules

## Core purpose

Dungeon Portal is a shared story driven by player choices, but rules and outcomes must be fair, consistent, and understandable. Fun matters, but truth of state matters more.

## What the DM is in Dungeon Portal

In this system the “DM” is split:

- Accountant (authoritative): resolves rules, rolls, state updates, loot, XP, conditions.
- Narrator (optional flavor): describes what the Accountant already decided. Never changes mechanics.

## Table rules

- Not a competition: the DM/system is not trying to “win.”
- Be fair and consistent: same input + same state = same outcome (unless dice).
- Communicate clearly: if the system can’t interpret an action, it asks for clarification or falls back to a safe resolution.
- Mistakes happen: correct and move on; don’t stall play.

## Game flow (per action / encounter)

- Describe situation (short; what’s obvious right now).
- Player acts (free input).
- Resolve outcome using one of these: no roll needed (trivial, safe, no opposition); skill check vs DC (uncertain, obstacles, investigation, social, stunts); combat rules (attack rolls/saves, initiative order if used); spell/ability rules (use ability data; exceptions override general rules).
- Report results clearly (facts first; flavor second).
- Loop.

## Adjudication rules

- One action at a time: actions have limits (action/bonus/reaction).
- Exceptions override general rules: abilities/items/features beat baseline rules.
- Unknown ≠ true: if state doesn’t say it exists, it’s not present.
- Rules aren’t physics: reject loopholes that break realism or intent.
- The game isn’t an economy simulator: block infinite money exploits.

## Handling “weird” player asks

- Use the Stunt Resolver: map unusual actions to a category (physical / mental / social / exploration / combat trick); choose a skill + DC; roll and apply a generic success/failure effect; if it’s impossible, say so cleanly and move on.

## Pacing and time

- Skip mundane detail unless it’s the point.
- Summarize travel/rest quickly.
- Use breaks between major scenes or after tense combat.
- Avoid ending mid-encounter unless you want a cliffhanger.

## Player behavior and safety

- Respect first: no bullying, harassment, or disruptive play.
- Shared spotlight: don’t let one player dominate.
- Limits: support hard/soft limits; allow a “stop” signal and adjust immediately.
- Intra-party conflict: OK if everyone agrees and it stays fun; otherwise stop it.

## Rules discussion policy

- Prefer fast rulings to keep play moving.
- Record rulings as house rules to stay consistent later.

## Minimal kit for the system

- Dice (digital).
- State tracking: HP, AC, conditions, initiative/turn, inventory, quest flags.
- Character sheet data and ability/item reference data.

## Where these rules apply (code map)

- Accountant (authoritative rules/state): `lib/game/engine/index.ts`, `lib/game/state.ts`, `lib/game/dice.ts`
- Narrator (flavor only): `lib/narrationEngine.ts` and log rendering in `app/page.tsx`
- Intent parsing / action routing: `lib/game/intent.ts`, `lib/5e/intents.ts`
- Stunt resolver for “weird” asks: `lib/stunts.ts` + resolution in `lib/game/engine/index.ts`
- Facts-first logging: `lib/game/engine/index.ts` (log entry creation)
