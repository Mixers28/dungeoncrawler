import { z } from 'zod';
import rawManifest from '../../data/visual/asset-manifest.json';

export const visualAssetKindSchema = z.enum(['scene', 'monster', 'item', 'portrait', 'spell', 'ui']);
export const visualAssetSourceSchema = z.enum(['generated', 'existing', 'fallback', 'cached']);

export const visualAssetSchema = z.object({
  id: z.string().min(1),
  kind: visualAssetKindSchema,
  path: z.string().startsWith('/'),
  styleVersion: z.string().min(1),
  prompt: z.string().optional(),
  source: visualAssetSourceSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  tags: z.array(z.string()).default([]),
});

export const visualAssetManifestSchema = z.object({
  version: z.number().int().positive(),
  styleVersion: z.string().min(1),
  assets: z.array(visualAssetSchema),
});

export type VisualAssetKind = z.infer<typeof visualAssetKindSchema>;
export type VisualAssetSource = z.infer<typeof visualAssetSourceSchema>;
export type VisualAsset = z.infer<typeof visualAssetSchema>;
export type VisualAssetManifest = z.infer<typeof visualAssetManifestSchema>;

export const visualAssetManifest: VisualAssetManifest = visualAssetManifestSchema.parse(rawManifest);

export function normalizeVisualAssetId(value: string | undefined | null): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildAssetIndex(): Map<string, VisualAsset> {
  const index = new Map<string, VisualAsset>();
  for (const asset of visualAssetManifest.assets) {
    const exactKey = `${asset.kind}:${asset.id}`;
    const normalizedKey = `${asset.kind}:${normalizeVisualAssetId(asset.id)}`;
    if (index.has(exactKey) || (normalizedKey !== exactKey && index.has(normalizedKey))) {
      throw new Error(`Duplicate visual asset entry for ${asset.kind}:${asset.id}`);
    }
    index.set(exactKey, asset);
    index.set(normalizedKey, asset);
  }
  return index;
}

const assetIndex = buildAssetIndex();

export function getVisualAsset(kind: VisualAssetKind, id: string | undefined | null): VisualAsset | null {
  if (!id) return null;
  return assetIndex.get(`${kind}:${id}`) || assetIndex.get(`${kind}:${normalizeVisualAssetId(id)}`) || null;
}

export function resolveVisualAsset(
  kind: VisualAssetKind,
  candidates: Array<string | undefined | null>,
  fallbackId?: string
): VisualAsset | null {
  for (const candidate of candidates) {
    const asset = getVisualAsset(kind, candidate);
    if (asset) return asset;
  }
  return fallbackId ? getVisualAsset(kind, fallbackId) : null;
}

export function resolveVisualAssetPath(
  kind: VisualAssetKind,
  candidates: Array<string | undefined | null>,
  fallbackPath: string,
  fallbackId?: string
): string {
  return resolveVisualAsset(kind, candidates, fallbackId)?.path || fallbackPath;
}
