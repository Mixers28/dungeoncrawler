const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function resolveSha() {
  const envSha =
    process.env.NEXT_PUBLIC_GIT_SHA ||
    process.env.GIT_SHA ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA;

  if (envSha) return envSha.trim().slice(0, 12);

  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

const sha = resolveSha();
const builtAt = new Date().toISOString();
const content = `export const BUILD_SHA = '${sha}';\nexport const BUILD_TIME = '${builtAt}';\n`;

const targetPath = path.join(process.cwd(), 'lib', 'build-info.ts');
fs.writeFileSync(targetPath, content, 'utf8');
console.log(`Wrote build info to ${targetPath}`);
