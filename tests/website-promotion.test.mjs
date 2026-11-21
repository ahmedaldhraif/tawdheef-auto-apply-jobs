import test from 'node:test';
import assert from 'node:assert/strict';
import { promoteWebsite } from '../scripts/marketing/promote-website.mjs';

const origin = 'https://tawdheef-auto-apply-jobs-fixture-ahmeds-projects-de4c877f.vercel.app';
const projectId = 'prj_RIT5Jkf1El5exwYMeHdvgwxgdeQz';
const sha = 'a'.repeat(40);
const fixtureToken = 'fixture-only-not-an-authentication-credential';
const fixtureDeployment = () => ({ id: 'dpl_fixture', projectId, url: new URL(origin).hostname,
  target: 'production', readyState: 'READY', meta: { githubCommitSha: sha } });

test('project-only promotion waits for its own successful alias job and actual domain assignment', async () => {
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
    if (url.endsWith(`/projects/${projectId}`)) {
      return Response.json({ id: projectId, lastAliasRequest: ++polls === 1
        ? { toDeploymentId: 'dpl_previous', jobStatus: 'succeeded' }
        : { toDeploymentId: 'dpl_fixture', jobStatus: 'succeeded' } });
    }
    return Response.json({ ...fixtureDeployment(), alias: url.endsWith('/dpl_fixture') ? ['www.tawdheef.com'] : [] });
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

test('provider errors do not disclose credentials and incomplete alias results never claim success', async () => {
  await assert.rejects(promoteWebsite(origin, { token: fixtureToken, expectedSha: sha,
    fetchImpl: async () => new Response(fixtureToken, { status: 403 }) }), error =>
    error.message.includes('HTTP 403') && !error.message.includes(fixtureToken));
  for (const state of ['failed', 'succeeded']) {
    let clock = 0;
    await assert.rejects(promoteWebsite(origin, { token: fixtureToken, expectedSha: sha, now: () => clock,
      timeoutMs: 3000, sleepImpl: async () => { clock += 2000; }, fetchImpl: async (url, options) => {
        if (options.method === 'POST') return new Response(null, { status: 200 });
        if (url.endsWith(`/projects/${projectId}`)) return Response.json({ id: projectId,
          lastAliasRequest: { toDeploymentId: 'dpl_fixture', jobStatus: state } });
        return Response.json({ ...fixtureDeployment(), alias: [] });
      } }), state === 'failed' ? /promotion failed/ : /not confirmed/);
  }
  await assert.rejects(promoteWebsite('https://www.tawdheef.com', { token: fixtureToken, expectedSha: sha }), /staged project deployment/);
});
