# Publishing under the `@myria-network` npm scope

The GitHub account or organization named `myria-network` does not automatically reserve the same name on npm. npm manages scopes independently.

## One-time npm setup

1. Create an npm user account at [npmjs.com](https://www.npmjs.com/).
2. Enable two-factor authentication on that account.
3. From the npm profile menu, choose **Add Organization**.
4. Create the organization with the exact name `myria-network`. The organization name becomes the `@myria-network` scope.
5. Select the free public-packages plan unless private npm packages are required.
6. Add each maintainer to the organization and grant publish access through an npm team.

The package is already named correctly:

```json
{
  "name": "@myria-network/observer"
}
```

## First publication

Authenticate interactively on a maintainer workstation:

```bash
npm login
npm whoami
```

Never paste an npm password, one-time code, recovery code, or access token into an issue, commit, chat, or shell history.

Review the exact package contents and run the tests:

```bash
npm ci
npm test
npm pack --dry-run
```

Publish the first public version:

```bash
npm publish --access public
```

Scoped packages default to private visibility, so `--access public` is required for a public first release. Direct publication requires account 2FA or an eligible granular token. npm also supports staged publishing when a maintainer should approve the release before it becomes public.

## Recommended release path: GitHub Actions with OIDC

After the first package exists on npm, configure a trusted publisher in the npm package settings:

| npm field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `myria-network` |
| Repository | `Observer` |
| Workflow filename | `publish.yml` |
| Allowed action | Prefer staged publish initially; allow direct publish only if desired |

Trusted publishing uses short-lived OIDC credentials and does not store a long-lived npm write token in GitHub. It requires a GitHub-hosted runner, npm 11.5.1 or newer, Node.js 22.14.0 or newer, and `id-token: write` in the workflow.

A release workflow can use:

```yaml
name: Publish package

on:
  release:
    types: [published]

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24.14.0'
          registry-url: 'https://registry.npmjs.org'
          package-manager-cache: false
      - run: npm ci
      - run: npm test
      - run: npm publish
```

For a first cautious automation, replace the final command with `npm stage publish` and approve the staged package interactively with 2FA. Once trusted publishing works, configure npm publishing access to require 2FA and disallow traditional write tokens.

## Versioning

Before every release:

1. Update the package version using semantic versioning.
2. Update documentation and tests in the same commit.
3. Confirm `npm pack --dry-run` contains only intended public files.
4. Tag the exact reviewed commit.
5. Publish from that tag or GitHub Release.
6. Verify the npm provenance link resolves to the same public repository and commit.
