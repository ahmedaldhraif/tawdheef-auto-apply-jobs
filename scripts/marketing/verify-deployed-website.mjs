import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sharedAssets = [
  '/brand/github-hero/wordmark-light.gif', '/brand/github-hero/wordmark-dark.gif',
  '/brand/github-hero/wordmark-light.png', '/brand/github-hero/wordmark-dark.png',
  '/site-assets/hero-native-agent.js', '/site-assets/app-demo.js', '/demo/', '/llms.txt', '/sitemap.xml', '/robots.txt',
];

export function deploymentOrigin(value) {
  const url = new URL(value);
  const projectHost = /^tawdheef-auto-apply-jobs-[a-z0-9]+-ahmeds-projects-de4c877f\.vercel\.app$/;
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.pathname !== '/' || url.search || url.hash ||
      !(url.hostname === 'www.tawdheef.com' || projectHost.test(url.hostname))) {
    throw new Error('Use the existing Tawdheef production domain or project deployment origin.');
  }
  return url.origin;
}

const normalize = value => value.replaceAll('\r\n', '\n');
const stripToolbar = value => value.replace(/<script async data-explicit-opt-in="true" data-deployment-id="[^"]+" src="https:\/\/vercel\.live\/_next-live\/feedback\/feedback\.js"><\/script>$/, '');

export async function verifyDeployedWebsite(value, { directory = 'site-dist', fetchImpl = fetch } = {}) {
  const origin = deploymentOrigin(value);
  const sitemap = await readFile(resolve(directory, 'sitemap.xml'), 'utf8');
  const canonicalOrigin = 'https://www.tawdheef.com';
  const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, location]) => {
    const url = new URL(location);
    if (url.origin !== canonicalOrigin || !/^\/(?:[a-z0-9_-]+\/)*$/.test(url.pathname) || url.search || url.hash) {
      throw new Error('Unexpected sitemap URL.');
    }
    return url.pathname;
  });
  if (!pages.includes('/') || !pages.includes('/ar/') || !pages.includes('/skills/') || !pages.includes('/ar/skills/')) {
    throw new Error('The bilingual landing and Skills routes must be present.');
  }
  const demoHtml = await readFile(resolve(directory, 'demo/index.html'), 'utf8');
  const demoAssets = [...new Set([...demoHtml.matchAll(/(?:src|href)="(\/demo\/assets\/[a-zA-Z0-9_.-]+)"/g)].map(match => match[1]))];
  if (!demoAssets.some(path => path.endsWith('.js')) || !demoAssets.some(path => path.endsWith('.css'))) throw new Error('The checked native demo build is missing its script or styles.');
  const assets = [...sharedAssets, ...demoAssets];
  const results = [];
  const targets = [...pages.map(path => ({ path, page: true })), ...assets.map(path => ({ path, page: false }))];
  for (let offset = 0; offset < targets.length; offset += 4) {
    await Promise.all(targets.slice(offset, offset + 4).map(async ({ path, page }) => {
      try {
        const response = await fetchImpl(origin + path, { redirect: 'error', signal: AbortSignal.timeout(20000) });
        if (response.status !== 200) throw new Error(`HTTP ${response.status}; protected deployments need an authorized verification route.`);
        const actual = Buffer.from(await response.arrayBuffer());
        const expected = await readFile(resolve(directory, '.' + (page || path.endsWith('/') ? path + 'index.html' : path)));
        const binary = /\.(gif|png)$/.test(path);
        const html = actual.toString('utf8');
        if (page && html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] !== canonicalOrigin + path) {
          throw new Error('Canonical URL does not match this route.');
        }
        const received = (page || path === '/demo/') && origin !== canonicalOrigin ? stripToolbar(normalize(html)) : normalize(html);
        if (binary ? !actual.equals(expected) : received !== normalize(expected.toString('utf8'))) {
          throw new Error('Deployed content differs from the checked-out build.');
        }
        results.push({ path, ok: true });
      } catch (error) {
        results.push({ path, ok: false, error: error.message });
      }
    }));
  }
  return { origin, pages: pages.length, assets: assets.length, failures: results.filter(item => !item.ok) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = await verifyDeployedWebsite(process.argv[2]);
    console.log(JSON.stringify(report, null, 2));
    if (report.failures.length) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
