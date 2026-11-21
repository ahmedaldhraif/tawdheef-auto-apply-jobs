import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { deploymentOrigin } from './verify-deployed-website.mjs';

const projectId = 'prj_RIT5Jkf1El5exwYMeHdvgwxgdeQz';
const domain = 'www.tawdheef.com';

// Use only this project's resources. The CLI promote command also requests a user
// context, which project-scoped tokens deliberately cannot access.
export async function promoteWebsite(value, {
  token, expectedSha, fetchImpl = fetch, sleepImpl = sleep, now = Date.now, timeoutMs = 180000,
} = {}) {
  const origin = deploymentOrigin(value);
  if (new URL(origin).hostname === domain) throw new Error('Use the staged project deployment, not the live domain.');
  if (!token || !/^[0-9a-f]{40}$/.test(expectedSha ?? '')) throw new Error('A deployment credential and exact commit SHA are required.');
  const request = async (path, method = 'GET') => {
    const response = await fetchImpl('https://api.vercel.com' + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: '{}' } : {}),
    });
    // Do not echo provider error bodies or authentication material into CI logs.
    if (!response.ok) throw new Error(`Vercel project request failed: HTTP ${response.status} (${method}).`);
    return method === 'POST' ? undefined : response.json();
  };
  const deployment = await request('/v13/deployments/' + encodeURIComponent(new URL(origin).hostname));
  if (!/^dpl_[A-Za-z0-9]+$/.test(deployment.id ?? '') ||
      (deployment.projectId ?? deployment.project?.id) !== projectId ||
      deployment.url !== new URL(origin).hostname || deployment.target !== 'production' ||
      (deployment.readyState ?? deployment.state) !== 'READY' ||
      deployment.meta?.githubCommitSha !== expectedSha) {
    throw new Error('The staged deployment must belong to Tawdheef, be ready for production and match the checked commit.');
  }
  await request(`/v10/projects/${projectId}/promote/${deployment.id}`, 'POST');
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    // A deployment created with --skip-domain can retain an empty embedded
    // alias list after promotion. The domain mapping is the live authority.
    const alias = await request(`/v4/aliases/${domain}?projectId=${projectId}`);
    if (alias.projectId !== projectId || alias.alias !== domain) {
      throw new Error('Unexpected project or domain in production mapping.');
    }
    if ((alias.deploymentId ?? alias.deployment?.id) === deployment.id) {
      return { deploymentId: deployment.id, sha: expectedSha, domain, promoted: true };
    }
    await sleepImpl(2000);
  }
  throw new Error('Production promotion is not confirmed. Inspect Vercel before retrying.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await promoteWebsite(process.argv[2], {
      token: process.env.VERCEL_TOKEN, expectedSha: process.env.DEPLOY_SHA,
    }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
