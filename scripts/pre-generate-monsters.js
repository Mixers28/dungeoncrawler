#!/usr/bin/env node

/**
 * Monster Image Pre-generation Script
 * 
 * Generates stable image URLs for common dungeon monsters.
 * For now, this creates placeholders in the manifest.
 * In production, this would integrate with an image generation API.
 * 
 * Usage: node scripts/pre-generate-monsters.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List of monsters extracted from story/*.json files
// Plus additional common D&D monsters for future expansion
const COMMON_MONSTERS = [
  // Currently in game
  'Giant Rat',
  'Skeleton',
  'Skeleton Archer',
  'Skeleton Spearman',
  'Zombie',
  'Armoured Zombie',
  'Cultist Acolyte',
  'Fallen Knight',
  
  // Common D&D monsters for future expansion
  'Goblin',
  'Goblin Archer',
  'Orc',
  'Orc Warrior',
  'Wolf',
  'Dire Wolf',
  'Giant Spider',
  'Phase Spider',
  'Bandit',
  'Bandit Captain',
  'Cultist',
  'Cult Fanatic',
  'Ghost',
  'Specter',
  'Shadow',
  'Wraith',
  'Ghoul',
  'Ghast',
  'Kobold',
  'Kobold Inventor',
  'Stirge',
  'Swarm of Rats',
  'Animated Armor',
  'Flying Sword',
  'Mimic',
];

function normalizeMonsterType(name) {
  return name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
}

function getMonsterPrompt(monsterType) {
  const normalized = normalizeMonsterType(monsterType);
  
  const specialCases = {
    'giant_rat': 'A massive rat creature with glowing red eyes in a damp dungeon, fantasy art, dramatic shadows, menacing pose, top-down perspective',
    'skeleton': 'An animated skeleton warrior with rusted sword in a crypt, fantasy art, eerie blue glow, top-down perspective',
    'skeleton_archer': 'An undead skeleton archer with ancient bow in dark ruins, fantasy art, spectral arrows, top-down perspective',
    'skeleton_spearman': 'A skeletal warrior wielding a spear and shield in crypt, fantasy art, bone armor, top-down perspective',
    'zombie': 'A rotting zombie with tattered clothes shambling through dungeon, fantasy art, horror atmosphere, top-down perspective',
    'armoured_zombie': 'A heavily armored undead knight with rusted plate mail, fantasy art, dreadful, top-down perspective',
    'cultist_acolyte': 'A robed cultist with ritual dagger and dark symbols, fantasy art, ominous purple glow, top-down perspective',
    'fallen_knight': 'A corrupted knight in black armor with cursed greatsword, fantasy art, dark energy aura, boss monster, top-down perspective',
    'goblin': 'A cunning goblin with crude dagger in a dark cave, fantasy art, menacing grin, top-down perspective',
    'goblin_archer': 'A goblin archer with makeshift bow in shadows, fantasy art, sneaky pose, top-down perspective',
    'orc': 'A hulking orc warrior with battle scars and crude axe, fantasy art, aggressive stance, top-down perspective',
    'orc_warrior': 'An orc berserker with dual axes and war paint, fantasy art, savage, top-down perspective',
    'wolf': 'A feral wolf with glowing eyes stalking through dark forest, fantasy art, predatory, top-down perspective',
    'dire_wolf': 'A massive dire wolf with silver fur in moonlit clearing, fantasy art, alpha predator, top-down perspective',
    'giant_spider': 'A giant spider with dripping fangs in web-covered lair, fantasy art, menacing, top-down perspective',
    'phase_spider': 'An ethereal spider phasing between dimensions, fantasy art, magical shimmer, top-down perspective',
    'bandit': 'A ruthless bandit with mask and daggers in shadowy corridor, fantasy art, stealthy, top-down perspective',
    'bandit_captain': 'A scarred bandit leader with fine rapier and stolen armor, fantasy art, commanding presence, top-down perspective',
    'cultist': 'A hooded cultist in dark robes with unholy symbol, fantasy art, sinister, top-down perspective',
    'cult_fanatic': 'A wild-eyed cult leader with sacrificial blade, fantasy art, manic energy, eldritch symbols, top-down perspective',
    'ghost': 'A translucent ghost with ethereal glow in abandoned room, fantasy art, supernatural, mournful, top-down perspective',
    'specter': 'A spectral wraith with wispy form in haunted corridor, fantasy art, life-draining aura, top-down perspective',
    'shadow': 'A living shadow with barely visible form in darkness, fantasy art, creeping horror, top-down perspective',
    'wraith': 'A terrifying wraith with hollow eyes and spectral chains, fantasy art, soul-stealing, top-down perspective',
    'ghoul': 'A flesh-eating ghoul with elongated claws in graveyard, fantasy art, feral hunger, top-down perspective',
    'ghast': 'A paralytic ghast with rotting flesh and sharp teeth, fantasy art, nauseating, top-down perspective',
    'kobold': 'A small kobold with crude spear in trapped tunnel, fantasy art, crafty expression, top-down perspective',
    'kobold_inventor': 'A kobold tinkerer with explosive device and goggles, fantasy art, manic grin, top-down perspective',
    'stirge': 'A bat-like stirge with long proboscis in dark cave, fantasy art, blood-sucking pest, top-down perspective',
    'swarm_of_rats': 'A writhing swarm of rats with glowing eyes, fantasy art, overwhelming numbers, top-down perspective',
    'animated_armor': 'An empty suit of armor animated by magic in armory, fantasy art, glowing runes, top-down perspective',
    'flying_sword': 'A levitating longsword wreathed in magical energy, fantasy art, spinning blade, top-down perspective',
    'mimic': 'A shapeshifting mimic disguised as treasure chest with teeth, fantasy art, deceptive trap, top-down perspective',
  };
  
  return specialCases[normalized] || `A ${monsterType} in a dark dungeon, fantasy art style, dramatic lighting, top-down perspective`;
}

function generateManifest() {
  const monsters = COMMON_MONSTERS.map(name => ({
    monsterType: name,
    imageUrl: `/monster-cache/${normalizeMonsterType(name)}.png`,
    cachedAt: new Date().toISOString(),
    prompt: getMonsterPrompt(name),
  }));
  
  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    monsters,
  };
  
  return manifest;
}

function main() {
  console.log('🎨 Pre-generating monster image manifest...\n');
  
  const manifest = generateManifest();
  const manifestPath = path.join(__dirname, '..', 'public', 'monster-cache', 'manifest.json');
  
  // Write manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✅ Generated manifest with ${manifest.monsters.length} monsters`);
  console.log(`📝 Written to: ${manifestPath}\n`);
  
  // Print summary
  console.log('📋 Monster List:');
  console.log('─'.repeat(60));
  manifest.monsters.forEach((m, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${m.monsterType.padEnd(20)} → ${m.imageUrl}`);
  });
  console.log('─'.repeat(60));
  
  console.log('\n⚠️  Note: This script generates the manifest only.');
  console.log('   Actual image generation requires integration with an image API.');
  console.log('   For now, the game will use placeholder images for missing monsters.');
  console.log('\n💡 Next steps:');
  console.log('   1. Integrate with image generation API (DALL-E, Midjourney, etc.)');
  console.log('   2. Generate actual PNG files for each monster');
  console.log('   3. Save to public/monster-cache/{normalized_name}.png');
  console.log('   4. Update manifest with actual file sizes and metadata');
}

main();
