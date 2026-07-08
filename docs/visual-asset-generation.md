# Visual Asset Generation

Controlled OpenAI API workflow for generated visual assets.

## Ownership

- Antigravity owns prompts and art direction.
- Codex owns this script, manifest/path validation, and final promotion into `data/visual/asset-manifest.json`.
- Claude Code owns visual fit review in the UI.

## Safety Rules

- Do not commit `.env.local` or any API key.
- Set an OpenAI project budget cap before running generation.
- Generate candidates first; do not overwrite final files directly.
- Do not update `data/visual/asset-manifest.json` until candidates are reviewed.
- Reject tiny "32x32 scaled up" or "64x64 scaled up" prompts for monsters, portraits, and final item art.

## Setup

Add this to `.env.local`:

```bash
OPENAI_API_KEY=sk-...
ASSET_GEN_MAX_COST_USD=5
ASSET_GEN_MODEL=gpt-image-2
ASSET_GEN_QUALITY=medium
```

## Dry Run

Dry run writes a metadata plan and cost estimate only:

```bash
npm run assets:generate -- --kind=monster,item,portrait --source=generated --candidates=2
```

Use `--source=generated` to regenerate AGY's rejected generated monster/item/portrait entries.
Use `--source=fallback` for entries still on fallback.
Use `--ids=skeleton,zombie,fighter` for a targeted subset.

## Generate Candidates

```bash
npm run assets:generate -- --kind=monster,item,portrait --source=generated --candidates=2 --generate --max-cost=5
```

Output goes to:

```text
public/visual/_candidates/<batch-id>/<kind>/<asset-id>__c<n>.png
public/visual/_candidates/<batch-id>/metadata.json
```

The script does not update the manifest and does not replace final assets.

## Promotion

After review:

1. Pick one candidate per asset.
2. Copy selected files into the final folder:
   - `public/visual/monsters/<id>.png`
   - `public/visual/items/<id>.png`
   - `public/visual/portraits/<id>.png`
3. Update `data/visual/asset-manifest.json` with:
   - `source: "generated"`
   - final `/visual/...` path
   - batch `styleVersion`
   - prompt or revised prompt from candidate metadata
   - width and height if known
4. Run:

```bash
npm run test:unit
npx tsc --noEmit
npm run lint
```

## Recommended Defaults

- Scenes: `gpt-image-2`, `1536x1024`, `medium` first, `high` only for final replacements.
- Monsters: `gpt-image-2`, `1024x1024`, `medium`, neutral dark matte background.
- Items: `gpt-image-2`, `1024x1024`, `medium`, centered object icon.
- Portraits: `gpt-image-2`, `1024x1024`, `medium`, bust portrait.

`gpt-image-2` does not currently support transparent backgrounds, so use a neutral dark matte background and post-process only if a transparent cutout is required.
