import test from 'node:test';
import assert from 'node:assert/strict';
import { promoteWebsite } from '../scripts/marketing/promote-website.mjs';

const origin = 'https://tawdheef-auto-apply-jobs-fixture-ahmeds-projects-de4c877f.vercel.app';
const projectId = 'prj_RIT5Jkf1El5exwYMeHdvgwxgdeQz';
const sha = 'a'.repeat(40);
const fixtureToken = 'fixture-only-not-an-authentication-credential';
const fixtureDeployment = () => ({ id: 'dpl_fixture', projectId, url: new URL(origin).hostname,
  target: 'production', readyState: 'READY', meta: { githubCommitSha: sha } });

test('project-only promotion confirms the live alias even when embedded deployment aliases stay empty', async () => {
  const calls = [];
  let polls = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method });
    assert.equal(options.headers.Authorization, `Bearer ${fixtureToken}`);
    assert.equal(options.redirect, 'error');
    if (options.method === 'POST') {
      assert.equal(url, `https://api.vercel.com/v10/projects/${projectId}/promote/dpl_fixture`);
      assert.equal(options.body, '{}');
      return new Response(null, { status: 200 });
    }
    if (url === `https://api.vercel.com/v4/aliases/www.tawdheef.com?projectId=${projectId}`) {
      return Response.json({ projectId, alias: 'www.tawdheef.com',
        deploymentId: ++polls === 1 ? 'dpl_previous' : 'dpl_fixture' });
    }
    return Response.json({ ...fixtureDeployment(), alias: [] });
  };
  assert.deepEqual(await promoteWebsite(origin, { token: fixtureToken, expectedSha: sha, fetchImpl, sleepImpl: async () => {} }),
    { deploymentId: 'dpl_fixture', sha, domain: 'www.tawdheef.com', promoted: true });
  assert.equal(polls, 2);
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.ok(calls.every(call => !/\/user|\/teams/.test(call.url)));
});

test('foreign projects, wrong commits, unfinished builds and preview targets never reach promotion', async () => {
  for (const patch of [{ projectId: 'prj_other' }, { meta: { githubCommitSha: 'b'.repeat(40) } },
    { readyState: 'BUILDING' }, { target: 'preview' }, { url: 'other.vercel.app' }]) {
    let mutations = 0;
    await assert.rejects(promoteWebsite(origin, { token: fixtureToken, expectedSha: sha, fetchImpl: async (_url, options) => {
      if (options.method === 'POST') mutations++;
      return Response.json({ ...fixtureDeployment(), ...patch });
    } }), /must belong to Tawdheef/);
    assert.equal(mutations, 0);
  }
});

test('provider errors do not disclose credentials and old or foreign alias results never claim success', async () => {
  await assert.rejects(promoteWebsite(origin, { token: fixtureToken, expectedSha: sha,
    fetchImpl: async () => new Response(fixtureToken, { status: 403 }) }), error =>
    error.message.includes('HTTP 403') && !error.message.includes(fixtureToken));
  for (const patch of [{ deploymentId: 'dpl_previous' }, { projectId: 'prj_other' }, { alias: 'other.example' }]) {
    let clock = 0;
    await assert.rejects(promoteWebsite(origin, { token: fixtureToken, expectedSha: sha, now: () => clock,
      timeoutMs: 3000, sleepImpl: async () => { clock += 2000; }, fetchImpl: async (url, options) => {
        if (options.method === 'POST') return new Response(null, { status: 200 });
        if (url.includes('/v4/aliases/')) return Response.json({ projectId, alias: 'www.tawdheef.com',
          deploymentId: 'dpl_fixture', ...patch });
        return Response.json({ ...fixtureDeployment(), alias: [] });
      } }), patch.deploymentId ? /not confirmed/ : /Unexpected project or domain/);
  }
  await assert.rejects(promoteWebsite('https://www.tawdheef.com', { token: fixtureToken, expectedSha: sha }), /staged project deployment/);
});
