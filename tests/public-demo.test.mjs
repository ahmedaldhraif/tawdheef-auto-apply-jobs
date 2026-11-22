import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDemoStore } from '../src/demo/store.mjs';
import { appPreview } from '../website/walkthrough.mjs';

const clockStart = Date.parse('2026-11-22T10:00:00Z');
const actions = { applyMatchingJobs: true, createProfiles: true, sendCvEmails: false };
test('sample counters reconcile with independent application, profile and email records', async () => {
  const store = createDemoStore({ clock: () => clockStart });
  const boot = await store.request('/bootstrap');
  assert.equal(boot.directories.length, 6);
  for (const directory of boot.directories) {
    const totals = await store.request(`/snapshot?directoryId=${directory.id}&period=all_time`);
    assert.deepEqual(totals.counts, { applications: 2, profiles: 3, emails: 2 });
    for (const metric of ['applications', 'profiles', 'emails']) {
      const records = await store.request(`/snapshot?directoryId=${directory.id}&period=all_time&metric=${metric}`);
      assert.equal(records.total, totals.counts[metric]);
      assert.ok(records.items.every(r => r.demo && r.directoryId === directory.id));
    }
  }
});
test('a scoped demo run respects action choices, advances, stops and resets without external work', async () => {
  let now = clockStart;
  const store = createDemoStore({ clock: () => now });
  const result = await store.request('/native/runs', 'POST', { directoryId: 'uae', companyIds: ['uae-sample-4', 'uae-sample-5'], actions });
  assert.equal(result.run.total, 2);
  now += 1700;
  const first = await store.request(`/runs/${result.run.id}`);
  assert.equal(first.completed, 1);
  assert.equal(first.status, 'running');
  const stopped = await store.request(`/runs/${result.run.id}/stop`, 'POST');
  assert.equal(stopped.status, 'cancelled');
  now += 9000;
  const unchanged = await store.request(`/runs/${result.run.id}`);
  assert.equal(unchanged.completed, 1);
  assert.deepEqual((await store.request('/snapshot?directoryId=uae')).counts, { applications: 3, profiles: 4, emails: 2 });
  assert.deepEqual((await store.request('/snapshot?directoryId=qatar')).counts, { applications: 2, profiles: 3, emails: 2 });
  store.reset();
  assert.equal((await store.request('/bootstrap')).runs.length, 0);
  assert.deepEqual((await store.request('/snapshot?directoryId=uae')).counts, { applications: 2, profiles: 3, emails: 2 });
});
test('profile-only and CV-email-only demos do not manufacture applications', async () => {
  for (const selected of [{ applyMatchingJobs: false, createProfiles: true, sendCvEmails: false }, { applyMatchingJobs: false, createProfiles: false, sendCvEmails: true }]) {
    let now = clockStart;
    const store = createDemoStore({ clock: () => now });
    const { run } = await store.request('/native/runs', 'POST', { directoryId: 'uae', actions: selected });
    now += 20000;
    assert.equal((await store.request(`/runs/${run.id}`)).status, 'completed');
    const counts = (await store.request('/snapshot?directoryId=uae')).counts;
    assert.equal(counts.applications, 2);
    assert.equal(counts.profiles, selected.createProfiles ? 7 : 3);
    assert.equal(counts.emails, selected.sendCvEmails ? 6 : 2);
  }
});
test('unsupported operations fail closed and responses cannot mutate internal records', async () => {
  const store = createDemoStore();
  for (const path of ['/email/send', '/import/preview', '/native/connection-request', '/native/readiness', '//localhost:4000/api', 'https://example.com']) await assert.rejects(store.request(path, 'POST', {}));
  const boot = await store.request('/bootstrap');
  boot.directories[0].name = 'Changed outside';
  assert.equal((await store.request('/bootstrap')).directories[0].name, 'UAE');
  const source = await readFile(new URL('../src/demo/store.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|node:|server\//);
  const html = await readFile(new URL('../src/demo/index.html', import.meta.url), 'utf8');
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
});
test('both locales share the native entry point and correctly scoped, labelled embeds', async () => {
  for (const locale of ['en', 'ar']) {
    const store = createDemoStore({ language: locale });
    const boot = await store.request('/bootstrap');
    assert.equal(boot.settings.language, locale);
    assert.equal(boot.directories[0].name, locale === 'ar' ? 'الإمارات' : 'UAE');
    const html = appPreview(locale);
    assert.match(html, new RegExp(`/demo/\\?lang=${locale}&amp;embed=1`));
    assert.match(html, /sandbox="allow-scripts allow-same-origin"/);
    assert.doesNotMatch(html, /native-desktop-light\.jpg/);
  }
});

test('filtering to a profile-only sample company cannot invent a matching vacancy', async () => {
  let now = clockStart;
  const store = createDemoStore({ clock: () => now });
  const jobs = await store.request('/discovery/jobs?directoryId=uae&companyIds=["uae-sample-5"]');
  assert.equal(jobs.total, 0);
  const { run } = await store.request('/native/runs', 'POST', { directoryId: 'uae', companyIds: ['uae-sample-5'], actions });
  now += 5000;
  await store.request(`/runs/${run.id}`);
  assert.deepEqual((await store.request('/snapshot?directoryId=uae')).counts, { applications: 2, profiles: 4, emails: 2 });
});
