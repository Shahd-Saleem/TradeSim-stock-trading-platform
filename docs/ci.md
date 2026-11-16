# Continuous integration and deployment gates

`.github/workflows/ci.yml` runs on every push, pull request and manual dispatch. Its single required-check candidate is **TradeSim CI**, under workflow **CI**. Vercel continues handling Git deployments and its existing daily cron; this workflow does not deploy, promote, access Vercel, or change project settings.

## What the workflow verifies

The Ubuntu runner installs Node 24 from `package.json` and runs `npm ci` using `package-lock.json`, including the existing Prisma generation lifecycle. It then runs the actual project scripts for lint, unit/UI tests, PostgreSQL integration tests, migrations, seed, production build and TypeScript. TypeScript runs after the build because a fresh checkout needs Next's generated route declarations referenced by `next-env.d.ts`.

Every step is required: failures stop the job and mark the check failed. There is no `continue-on-error` or skipped integration-test fallback. A 20-minute timeout and per-ref cancellation prevent stale jobs consuming runner time. Checkout/setup actions are pinned to reviewed commit SHAs; update these pins deliberately when updating actions. The workflow token has read-only repository permissions and checkout does not persist credentials. It uses `pull_request`, never `pull_request_target`.

## Isolated PostgreSQL and safe configuration

Each job gets a disposable PostgreSQL 17 service. All four database environment variables point explicitly to that service on localhost, never Supabase. The public passwords in the YAML belong only to this disposable service; **no GitHub repository secrets are needed**.

The existing database adapter requires verified TLS. `scripts/ci/setup-postgres.mjs` generates a one-day localhost certificate with OpenSSL, configures the service to use it, and creates the restricted `tradesim_runtime` role. Both application connections and migrations continue verifying certificate/hostname trust. The helper requires explicit CI configuration, loopback connections, the CI database name and the matching disposable container. It does not load `.env.local` or relax application TLS behavior.

Integration tests already create random isolated schemas and apply migrations. Separate migration/seed steps also validate a fresh application schema in the disposable database. The runner destroys the service after the job. Auth uses an explicit test-only secret and localhost origin. The cron flag is disabled and market-writer/cron credentials are empty. No production connection, authentication secret, certificate, deploy token, migration credential or database write is needed outside this disposable service. CI does not upload `.env` files, certificates, private keys or build artifacts.

## Verify in GitHub

1. After reviewing and committing the change, push it when you are ready. No push or commit is performed by this implementation.
2. Open the repository's **Actions** tab, select **CI**, and open the run for your commit. Expand **TradeSim CI** to see installation, database setup and each required check.
3. Confirm the run is green. Pull requests also show the check in their Checks/merge sections. A failed step exposes its command log; fix the failure and push another commit, or use Re-run jobs for a transient infrastructure failure.
4. `workflow_dispatch` adds **Run workflow** once the workflow is present on the default branch. Fork PRs may require GitHub's initial approval before running; they still need no production secrets.
5. To demonstrate enforcement, use a disposable PR branch with a deliberately failing assertion, observe a failed test/check and blocked merge after branch rules are configured, then remove that assertion. Do not merge the deliberate failure.

Local commands remain `npm run lint`, `npm test`, `npm run test:integration`, `npm run build` and `npm run typecheck`. To reproduce the integration environment, use a fresh PostgreSQL 17 Docker container with database `tradesim_ci`, set the same CI-only variables as the workflow (adjust the host port and choose a writable temporary certificate path for your OS), set `CI_POSTGRES_CONTAINER` to its ID/name and run the setup helper. `CI_OPENSSL_BIN` can point to Git's OpenSSL executable on Windows. Do not substitute production test URLs. Stop your disposable container afterwards.

## Make successful CI a release requirement

Adding this workflow alone does **not** delay Vercel's automatic production promotion. GitHub Actions and Vercel initially run independently. `vercel.json` currently configures the market cron, not release gates, and this change preserves it.

For a direct promotion gate, open Vercel **Project Settings → Deployment Checks → Add Checks → GitHub** and select **TradeSim CI** after its first run. Keep the existing Git integration and production domain auto-assignment enabled. Vercel then builds as usual and holds domain promotion until the selected commit check passes. This uses the current Git deployment model without another deployment workflow. See [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks).

The repository is compatible with that setup, but local files cannot confirm whether the remote project already has gates, whether automatic domain assignment is enabled, or whether the feature is available in your account's UI. Confirm those settings manually; none were changed here. Do not use Force Promote to demonstrate an enforced gate.

Also protect your Vercel production branch in GitHub: require PRs, require **TradeSim CI** from GitHub Actions, require an up-to-date branch and apply the rules to bypass-capable administrators where appropriate. This prevents failing changes being merged normally; it is distinct from holding promotion for the exact production commit. If Vercel Deployment Checks are unavailable, the protected-PR approach preserves Git-based deployments but does not independently gate a production deployment already triggered by a bypass/direct push. See [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

Do not add Vercel deploy hooks, tokens or CLI deployment jobs to this CI workflow. Those would introduce another deployment path and require a separately approved deployment design.

## Local verification

The workflow command sequence was replayed locally with a clean `npm ci`, a disposable PostgreSQL 17 container and a generated trusted localhost certificate. ESLint, 158 unit/UI tests, 31 PostgreSQL integration tests, migration deployment, seeding, the production build and TypeScript all passed. Actionlint and formatting validation passed for the workflow/helper. A real GitHub-hosted run remains to be verified after your approved push.

The clean install reported seven moderate dependency advisories; a separate production-only npm audit reported zero. Dependency upgrades are outside this CI change. The application database, Vercel configuration and remote deployment settings were not modified.
