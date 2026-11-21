import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { deploymentOrigin, verifyDeployedWebsite } from '../scripts/marketing/verify-deployed-website.mjs';

const production = 'https://www.tawdheef.com';
const preview = 'https://tawdheef-auto-apply-jobs-abc123-ahmeds-projects-de4c877f.vercel.app';

test('deployment verification refuses credentials, redirects encoded as paths and other origins', () => {
  assert.equal(deploymentOrigin(production + '/'), production);
  assert.equal(deploymentOrigin(preview), preview);
  for (const value of ['https://other.vercel.app', 'https://www.tawdheef.com.evil.test', 'http://www.tawdheef.com',
    'https://user:secret@www.tawdheef.com', production + '/skills/', production + '?token=value', production + '#fragment']) {
    assert.throws(() => deploymentOrigin(value));
  }
});

test('only matching bilingual pages and exact shared assets pass staged and public checks', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'tawdheef-site-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const routes = ['/', '/ar/', '/skills/', '/ar/skills/', '/guides/', '/ar/guides/'];
  const files = new Map(routes.map(path => [path, Buffer.from(`<link rel="canonical" href="${production}${path}"><p>Career profiles. ملف مهني.</p>`)]));
  files.set('/sitemap.xml', Buffer.from(`<urlset>${routes.map(path => `<url><loc>${production}${path}</loc></url>`).join('')}</urlset>`));
  for (const path of ['/brand/github-hero/wordmark-light.gif', '/brand/github-hero/wordmark-dark.gif',
    '/brand/github-hero/wordmark-light.png', '/brand/github-hero/wordmark-dark.png']) files.set(path, Buffer.from([0, 255, 8, 128]));
  for (const path of ['/site-assets/hero-native-agent.js', '/llms.txt', '/robots.txt']) files.set(path, Buffer.from('Public fixture\n'));
  for (const [path, content] of files) {
    const destination = join(directory, '.' + (routes.includes(path) ? path + 'index.html' : path));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  let changed = '';
  let status = 200;
  let canonicalMismatch = false;
  const fetchImpl = async (url, options) => {
    assert.equal(options.redirect, 'error');
    const path = new URL(url).pathname;
    let body = files.get(path);
    if (path === changed) body = Buffer.from('Outdated native agent');
    if (path === '/ar/skills/' && canonicalMismatch) body = Buffer.from(`<link rel="canonical" href="${production}/skills/">`);
    if (url.startsWith(preview) && routes.includes(path)) body = Buffer.from(body.toString() + '<script async data-explicit-opt-in="true" data-deployment-id="fixture" src="https://vercel.live/_next-live/feedback/feedback.js"></script>');
    return new Response(body, { status });
  };
  for (const origin of [production, preview]) {
    const result = await verifyDeployedWebsite(origin, { directory, fetchImpl });
    assert.deepEqual(result, { origin, pages: 6, assets: 8, failures: [] });
  }
  changed = '/brand/github-hero/wordmark-dark.gif';
  assert.deepEqual((await verifyDeployedWebsite(preview, { directory, fetchImpl })).failures.map(item => item.path), [changed]);
  changed = '';
  canonicalMismatch = true;
  assert.deepEqual((await verifyDeployedWebsite(production, { directory, fetchImpl })).failures.map(item => item.path), ['/ar/skills/']);
  canonicalMismatch = false;
  status = 401;
  assert.equal((await verifyDeployedWebsite(preview, { directory, fetchImpl })).failures.length, 14);
});
