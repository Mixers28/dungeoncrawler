import fs from 'node:fs/promises';
import path from 'node:path';
import manifest from '../data/visual/asset-manifest.json';

type AssetKind = 'scene' | 'monster' | 'item' | 'portrait' | 'ui';
type AssetSource = 'generated' | 'existing' | 'fallback' | 'cached';

type ManifestAsset = {
  id: string;
  kind: AssetKind;
  path: string;
  styleVersion: string;
  source: AssetSource;
  prompt?: string;
  width?: number;
  height?: number;
  tags?: string[];
};

type CliOptions = {
  kinds: Set<AssetKind>;
  ids: Set<string>;
  source: AssetSource | 'all';
  candidates: number;
  model: string;
  quality: 'low' | 'medium' | 'high';
  size?: string;
  outputRoot: string;
  styleVersion: string;
  maxCostUsd: number;
  generate: boolean;
  limit?: number;
  promptSuffix?: string;
};

type GenerationJob = {
  asset: ManifestAsset;
  candidateIndex: number;
  prompt: string;
  model: string;
  quality: 'low' | 'medium' | 'high';
  size: string;
  estimatedCostUsd: number;
  outputPath: string;
  referenceImagePath?: string;
};

const ASSET_KINDS = new Set<AssetKind>(['scene', 'monster', 'item', 'portrait', 'ui']);
const ASSET_SOURCES = new Set<AssetSource>(['generated', 'existing', 'fallback', 'cached']);

const COSTS_USD: Record<string, Record<string, Record<'low' | 'medium' | 'high', number>>> = {
  'gpt-image-2': {
    '1024x1024': { low: 0.006, medium: 0.053, high: 0.211 },
    '1024x1536': { low: 0.005, medium: 0.041, high: 0.165 },
    '1536x1024': { low: 0.005, medium: 0.041, high: 0.165 },
  },
  'gpt-image-1.5': {
    '1024x1024': { low: 0.009, medium: 0.034, high: 0.133 },
    '1024x1536': { low: 0.013, medium: 0.05, high: 0.2 },
    '1536x1024': { low: 0.013, medium: 0.05, high: 0.2 },
  },
  'gpt-image-1': {
    '1024x1024': { low: 0.011, medium: 0.042, high: 0.167 },
    '1024x1536': { low: 0.016, medium: 0.063, high: 0.25 },
    '1536x1024': { low: 0.016, medium: 0.063, high: 0.25 },
  },
  'gpt-image-1-mini': {
    '1024x1024': { low: 0.005, medium: 0.011, high: 0.036 },
    '1024x1536': { low: 0.006, medium: 0.015, high: 0.052 },
    '1536x1024': { low: 0.006, medium: 0.015, high: 0.052 },
  },
};

function usage(): never {
  console.log(`Usage:
  npm run assets:generate -- --kind=monster --source=generated --candidates=3
  npm run assets:generate -- --kind=monster,item,portrait --source=all --candidates=2 --generate --max-cost=5
  npm run assets:generate -- --ids=skeleton,zombie,fighter --generate

Options:
  --generate              Call the OpenAI API. Omit for dry-run planning.
  --kind=<list>           Comma-separated asset kinds: scene, monster, item, portrait, ui.
  --ids=<list>            Comma-separated manifest ids to target.
  --source=<source>       fallback, existing, generated, cached, or all. Default: fallback.
  --candidates=<n>        Candidates per asset. Default: 2.
  --model=<model>         Default: gpt-image-2.
  --quality=<level>       low, medium, or high. Default: medium.
  --size=<WxH>            Override size. Defaults to 1536x1024 for scenes, 1024x1024 otherwise.
  --output-root=<path>    Default: public/visual/_candidates.
  --style-version=<tag>   Candidate batch style tag. Default: manifest styleVersion.
  --max-cost=<usd>        Budget cap. Default: ASSET_GEN_MAX_COST_USD or 5.
  --limit=<n>             Limit selected assets before candidate expansion.
`);
  process.exit(1);
}

function parseList(value: string): string[] {
  return value.split(',').map(entry => entry.trim()).filter(Boolean);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    kinds: new Set(),
    ids: new Set(),
    source: 'fallback',
    candidates: 2,
    model: process.env.ASSET_GEN_MODEL || 'gpt-image-2',
    quality: (process.env.ASSET_GEN_QUALITY as CliOptions['quality']) || 'medium',
    outputRoot: 'public/visual/_candidates',
    styleVersion: manifest.styleVersion,
    maxCostUsd: Number(process.env.ASSET_GEN_MAX_COST_USD || 5),
    generate: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') usage();
    if (arg === '--generate') {
      options.generate = true;
      continue;
    }

    const [key, rawValue] = arg.split('=');
    const value = rawValue || '';
    if (!key.startsWith('--')) usage();

    switch (key) {
      case '--kind':
      case '--kinds':
        for (const kind of parseList(value)) {
          if (!ASSET_KINDS.has(kind as AssetKind)) throw new Error(`Unknown asset kind: ${kind}`);
          options.kinds.add(kind as AssetKind);
        }
        break;
      case '--id':
      case '--ids':
        for (const id of parseList(value)) options.ids.add(id);
        break;
      case '--source':
        if (value !== 'all' && !ASSET_SOURCES.has(value as AssetSource)) {
          throw new Error(`Unknown asset source: ${value}`);
        }
        options.source = value as CliOptions['source'];
        break;
      case '--candidates':
        options.candidates = positiveInteger(value, 'candidates');
        break;
      case '--model':
        options.model = value;
        break;
      case '--quality':
        if (!['low', 'medium', 'high'].includes(value)) throw new Error(`Unknown quality: ${value}`);
        options.quality = value as CliOptions['quality'];
        break;
      case '--size':
        options.size = value;
        break;
      case '--output-root':
        options.outputRoot = value;
        break;
      case '--style-version':
        options.styleVersion = value;
        break;
      case '--max-cost':
        options.maxCostUsd = Number(value);
        if (!Number.isFinite(options.maxCostUsd) || options.maxCostUsd <= 0) {
          throw new Error('--max-cost must be a positive number');
        }
        break;
      case '--limit':
        options.limit = positiveInteger(value, 'limit');
        break;
      case '--prompt-suffix':
        options.promptSuffix = value;
        break;
      default:
        throw new Error(`Unknown option: ${key}`);
    }
  }

  if (!['low', 'medium', 'high'].includes(options.quality)) {
    throw new Error(`Invalid ASSET_GEN_QUALITY: ${options.quality}`);
  }
  if (options.candidates > 5) {
    throw new Error('Refusing more than 5 candidates per asset in one run.');
  }
  return options;
}

function positiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${label} must be a positive integer`);
  return parsed;
}

function defaultSizeFor(kind: AssetKind): string {
  return kind === 'scene' ? '1536x1024' : '1024x1024';
}

function estimateCost(model: string, size: string, quality: 'low' | 'medium' | 'high'): number {
  return COSTS_USD[model]?.[size]?.[quality] ?? 0.25;
}

function humanizeId(id: string): string {
  return id
    .replace(/^fallback_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function findLivingCounterpart(asset: ManifestAsset): ManifestAsset | undefined {
  if (asset.kind !== 'monster' || !asset.id.endsWith('_dead')) return undefined;
  const livingId = asset.id.slice(0, -'_dead'.length);
  return (manifest.assets as ManifestAsset[]).find(candidate => candidate.id === livingId && candidate.kind === 'monster');
}

function promptFor(asset: ManifestAsset, styleVersion: string): string {
  const name = humanizeId(asset.id);
  const baseStyle = [
    'Eye of the Beholder 3 inspired 1990s fantasy dungeon crawler art',
    'rich painted VGA-era look with detailed dithering and moody torchlit contrast',
    'clear silhouette, readable at in-game UI size',
    'no text, no watermark, no UI frame, no caption',
    `batch style tag: ${styleVersion}`,
  ].join(', ');

  const livingCounterpart = findLivingCounterpart(asset);
  if (livingCounterpart) {
    return [
      `Edit this exact creature into its dead state: ${humanizeId(livingCounterpart.id)}.`,
      'Keep the same character identity, proportions, colors, armor, and weapon design from the reference image.',
      'Show it visibly wounded, damaged, and dead: gashes, gouges, cracked/broken bone or armor, blood, torn flesh or fabric, dulled eyes.',
      'Slumped, fallen, or crumpled posture consistent with a corpse, not standing at attention, but keep the full body readable as the same creature, not flattened into an unreadable heap.',
      'Neutral dark matte background, strong edge contrast, no floor shadow that would hide the silhouette.',
      baseStyle,
    ].join(' ');
  }

  if (asset.kind === 'scene') {
    return [
      `First-person dungeon scene: ${name}.`,
      'Camera is centered in a grid-cell corridor or room, looking straight ahead.',
      'Readable exits, doors, loot, and interactable objects should be visually clear.',
      baseStyle,
      asset.prompt ? `Existing art note: ${asset.prompt}` : '',
    ].filter(Boolean).join(' ');
  }

  if (asset.kind === 'monster') {
    return [
      `Full-body fantasy monster standee: ${name}.`,
      'Front-facing or three-quarter pose, complete body visible, usable as an overlay in a first-person dungeon viewport.',
      'Neutral dark matte background, strong edge contrast, no floor shadow that would hide the silhouette.',
      'Detailed creature identity, not a symbolic icon and not a stick figure.',
      baseStyle,
    ].join(' ');
  }

  if (asset.kind === 'item') {
    return [
      `Single fantasy inventory item icon: ${name}.`,
      'Object centered, isolated, readable at 48px, three-quarter tabletop perspective.',
      'Neutral dark matte background, strong outline, no hands, no character, no UI border.',
      'Detailed object, not a flat symbolic glyph.',
      baseStyle,
    ].join(' ');
  }

  if (asset.kind === 'portrait') {
    return [
      `Bust portrait of a fantasy adventurer class: ${name}.`,
      'Head and shoulders visible, class gear readable, neutral serious expression.',
      'Dark painted portrait background with subtle dungeon lighting, no solid flat color block.',
      'Detailed face and equipment, not a pixel glyph.',
      baseStyle,
    ].join(' ');
  }

  return [`Fantasy UI asset: ${name}.`, baseStyle].join(' ');
}

function selectAssets(options: CliOptions): ManifestAsset[] {
  let assets = (manifest.assets as ManifestAsset[]).filter(asset => {
    const kindMatches = options.kinds.size === 0 || options.kinds.has(asset.kind);
    const idMatches = options.ids.size === 0 || options.ids.has(asset.id);
    const sourceMatches = options.source === 'all' || asset.source === options.source;
    return kindMatches && idMatches && sourceMatches;
  });

  if (options.limit !== undefined) assets = assets.slice(0, options.limit);
  return assets;
}

function buildJobs(assets: ManifestAsset[], options: CliOptions, batchId: string): GenerationJob[] {
  const jobs: GenerationJob[] = [];
  for (const asset of assets) {
    const size = options.size || defaultSizeFor(asset.kind);
    const livingCounterpart = findLivingCounterpart(asset);
    for (let i = 1; i <= options.candidates; i += 1) {
      const prompt = options.promptSuffix
        ? `${promptFor(asset, options.styleVersion)} ${options.promptSuffix}`
        : promptFor(asset, options.styleVersion);
      jobs.push({
        asset,
        candidateIndex: i,
        prompt,
        model: options.model,
        quality: options.quality,
        size,
        estimatedCostUsd: estimateCost(options.model, size, options.quality),
        outputPath: path.join(options.outputRoot, batchId, asset.kind, `${asset.id}__c${i}.png`),
        referenceImagePath: livingCounterpart ? path.join('public', livingCounterpart.path) : undefined,
      });
    }
  }
  return jobs;
}

async function generateImageEdit(job: GenerationJob): Promise<{ revisedPrompt?: string; requestId?: string }> {
  if (!job.referenceImagePath) throw new Error('generateImageEdit requires referenceImagePath');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required when using --generate.');

  const referenceBytes = await fs.readFile(job.referenceImagePath);
  const form = new FormData();
  form.set('model', job.model);
  form.set('prompt', job.prompt);
  form.set('size', job.size);
  form.set('quality', job.quality);
  form.set('n', '1');
  form.set('image', new Blob([new Uint8Array(referenceBytes)], { type: 'image/png' }), path.basename(job.referenceImagePath));

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const requestId = response.headers.get('x-request-id') || undefined;
  const body = await response.json() as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
    error?: { message?: string; code?: string; type?: string };
  };

  if (!response.ok) {
    const message = body.error?.message || `OpenAI image edit failed with HTTP ${response.status}`;
    throw new Error(`${message}${requestId ? ` (request_id: ${requestId})` : ''}`);
  }

  const imageBase64 = body.data?.[0]?.b64_json;
  if (!imageBase64) throw new Error(`OpenAI response did not include image data${requestId ? ` (request_id: ${requestId})` : ''}`);

  await fs.mkdir(path.dirname(job.outputPath), { recursive: true });
  await fs.writeFile(job.outputPath, Buffer.from(imageBase64, 'base64'));
  return {
    revisedPrompt: body.data?.[0]?.revised_prompt,
    requestId,
  };
}

async function generateImage(job: GenerationJob): Promise<{ revisedPrompt?: string; requestId?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required when using --generate.');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: job.model,
      prompt: job.prompt,
      size: job.size,
      quality: job.quality,
      n: 1,
      output_format: 'png',
    }),
  });

  const requestId = response.headers.get('x-request-id') || undefined;
  const body = await response.json() as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
    error?: { message?: string; code?: string; type?: string };
  };

  if (!response.ok) {
    const message = body.error?.message || `OpenAI image generation failed with HTTP ${response.status}`;
    throw new Error(`${message}${requestId ? ` (request_id: ${requestId})` : ''}`);
  }

  const imageBase64 = body.data?.[0]?.b64_json;
  if (!imageBase64) throw new Error(`OpenAI response did not include image data${requestId ? ` (request_id: ${requestId})` : ''}`);

  await fs.mkdir(path.dirname(job.outputPath), { recursive: true });
  await fs.writeFile(job.outputPath, Buffer.from(imageBase64, 'base64'));
  return {
    revisedPrompt: body.data?.[0]?.revised_prompt,
    requestId,
  };
}

async function writeMetadata(
  jobs: GenerationJob[],
  options: CliOptions,
  batchId: string,
  results: Array<{ job: GenerationJob; revisedPrompt?: string; requestId?: string; error?: string }>
) {
  const metadataPath = path.join(options.outputRoot, batchId, 'metadata.json');
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.writeFile(metadataPath, JSON.stringify({
    batchId,
    generatedAt: new Date().toISOString(),
    dryRun: !options.generate,
    styleVersion: options.styleVersion,
    model: options.model,
    quality: options.quality,
    estimatedTotalCostUsd: sumCost(jobs),
    jobs: results.map(result => ({
      id: result.job.asset.id,
      kind: result.job.asset.kind,
      source: result.job.asset.source,
      candidateIndex: result.job.candidateIndex,
      size: result.job.size,
      prompt: result.job.prompt,
      outputPath: result.job.outputPath,
      estimatedCostUsd: result.job.estimatedCostUsd,
      revisedPrompt: result.revisedPrompt,
      requestId: result.requestId,
      error: result.error,
    })),
  }, null, 2));
  return metadataPath;
}

function sumCost(jobs: GenerationJob[]): number {
  return Number(jobs.reduce((sum, job) => sum + job.estimatedCostUsd, 0).toFixed(4));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const assets = selectAssets(options);
  const batchId = `${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}-${options.styleVersion}`;
  const jobs = buildJobs(assets, options, batchId);
  const estimatedTotal = sumCost(jobs);

  console.log(`Selected assets: ${assets.length}`);
  console.log(`Candidate images: ${jobs.length}`);
  console.log(`Model: ${options.model}`);
  console.log(`Quality: ${options.quality}`);
  console.log(`Estimated output cost: $${estimatedTotal.toFixed(4)}`);
  console.log(`Budget cap: $${options.maxCostUsd.toFixed(2)}`);
  console.log(`Mode: ${options.generate ? 'generate' : 'dry-run'}`);

  if (jobs.length === 0) {
    console.log('No matching assets. Use --source=all or --ids=... if you intend to regenerate existing/generated entries.');
    return;
  }
  if (estimatedTotal > options.maxCostUsd) {
    throw new Error(`Estimated cost $${estimatedTotal.toFixed(4)} exceeds --max-cost=$${options.maxCostUsd.toFixed(2)}.`);
  }

  const results: Array<{ job: GenerationJob; revisedPrompt?: string; requestId?: string; error?: string }> = [];
  if (!options.generate) {
    for (const job of jobs) results.push({ job });
    const metadataPath = await writeMetadata(jobs, options, batchId, results);
    console.log(`Dry-run metadata written to ${metadataPath}`);
    console.log('Add --generate to call the OpenAI API.');
    return;
  }

  for (const job of jobs) {
    const via = job.referenceImagePath ? `edit from ${job.referenceImagePath}` : 'text-to-image';
    console.log(`Generating ${job.asset.kind}:${job.asset.id} candidate ${job.candidateIndex} (${via}) -> ${job.outputPath}`);
    try {
      const result = job.referenceImagePath ? await generateImageEdit(job) : await generateImage(job);
      results.push({ job, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ job, error: message });
      console.error(`Failed ${job.asset.kind}:${job.asset.id} candidate ${job.candidateIndex}: ${message}`);
    }
  }

  const metadataPath = await writeMetadata(jobs, options, batchId, results);
  console.log(`Metadata written to ${metadataPath}`);
  console.log('Review candidates before copying accepted files into final public/visual folders or updating the manifest.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
