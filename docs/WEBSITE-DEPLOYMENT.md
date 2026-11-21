# Publish the website from GitHub

The existing Vercel project serves [www.tawdheef.com](https://www.tawdheef.com). Its GitHub sign-in can stay linked to its existing account. The [Publish website workflow](../.github/workflows/deploy-website.yml) uses the supported [GitHub Actions deployment route](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) instead of a direct Git integration.

The workflow defaults to disabled. Committing it does not establish credentials or prove that an automatic deployment has occurred.

## One-time maintainer setup

1. Create the `website-production` [GitHub environment](https://github.com/ahmedaldhraif/tawdheef-auto-apply-jobs/settings/environments). Restrict deployment branches to `main`. The existing main branch protections and required PR review remain in place. An environment reviewer can also be required if a manual approval before every deployment is preferred.
2. In [Vercel token settings](https://vercel.com/account/settings/tokens), create a deployment token: select **Ahmed's projects**, then select **tawdheef-auto-apply-jobs** rather than All Projects. Use a project-scoped token with an appropriate expiry so this workflow cannot access other projects or team-level resources. See [Vercel's token scope guide](https://vercel.com/docs/accounts/access-tokens#project-scoped-access-token). Do not paste its value into an issue, PR, chat or committed file.
3. Save the token directly as the `VERCEL_TOKEN` **environment secret** in `website-production`. The workflow contains only the existing non-secret team and project IDs. Do not add a public repository variable for the token.
4. After reviewing the merged workflow, set the repository Actions variable `WEBSITE_DEPLOY_ENABLED` to `true` in [Actions variables](https://github.com/ahmedaldhraif/tawdheef-auto-apply-jobs/settings/variables/actions).
5. Run **Publish website** from the [Actions page](https://github.com/ahmedaldhraif/tawdheef-auto-apply-jobs/actions/workflows/deploy-website.yml), selecting `main`. The selected commit must have successful **Verify local tracker** and **Check contributions** push runs. This first run verifies the credential, target, staging, promotion and public site together.

After activation, a successful **Verify local tracker** push run on `main` starts publication automatically. The workflow also waits for **Check contributions** on that same commit. PRs, forks, other branches and failed checks cannot deploy through it. Superseded commits are skipped. A manual run can retry the current checked `main` commit after a transient failure.

## What gets published

The build follows `vercel.json`, using the pinned Vercel CLI and Node 24 compatibility target. Promotion uses Vercel's project API directly because the CLI promotion command also looks up user-level context, which project-only tokens cannot access. The promotion helper requires the exact project, production target, ready state and checked commit, then waits for the successful alias job and verifies that `www.tawdheef.com` belongs to that deployment. It publishes the built English and Arabic landing pages, Skills, guides, country pages, shared native-agent artwork, sitemap, robots and agent navigation. It does not publish the Native app's database or install/release a desktop app.

The staged deployment is checked with `scripts/marketing/verify-deployed-website.mjs`: all sitemap pages must have the right canonical URL and match the checked-out build. Shared English/Arabic wordmark GIFs and fallback images, the native-agent script and crawl files must also match. Verification refuses other origins and HTTP redirects. A protected or unavailable deployment fails closed before promotion; do not disable deployment protection to bypass a failure. Configure an approved verification route before enabling publication if protection blocks these reads.

Vercel credentials are exposed only to its configuration, staging and promotion steps. Build output, downloaded environment files and authentication state are not uploaded as GitHub artifacts. Never run a secret-bearing deployment on unreviewed PR code.

## Verify or pause publication

- A successful **Publish website** run must show the source commit and successful staged/public checks in its summary. Confirm the same deployment in the existing Vercel project; a green app test run alone is not deployment evidence.
- Check the public [English](https://www.tawdheef.com/), [Arabic](https://www.tawdheef.com/ar/), [Skills](https://www.tawdheef.com/skills/) and [guides](https://www.tawdheef.com/guides/) pages. The verifier checks the complete generated sitemap in both languages.
- Set `WEBSITE_DEPLOY_ENABLED` to `false` to stop future runs before they obtain deployment credentials. Cancel an already running deployment separately.
- Rotate an expired or revoked token directly in the environment secret. No workflow code change is needed.
- Roll back using the existing Vercel project's deployment controls. Check domain assignment before re-enabling automatic publication after a rollback.

Automatic deployment publishes committed sources. It does not translate copy or capture new Native screenshots. Keep Native behavior, English/Arabic explanations and affected screenshot provenance together in the same PR, following [the repository guide](REPOSITORY.md#website-deployment-and-native-parity).
