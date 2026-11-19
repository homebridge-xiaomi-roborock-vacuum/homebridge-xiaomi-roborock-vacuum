---
name: release
description: Prepare and publish a new version of the plugin (changelog, version bump, release PR, auto-merge, version branch restore, GitHub release, which publishes to npm). Use when asked to release, cut, or prepare a new version (patch, minor, major or a prerelease).
argument-hint: "[patch|minor|major|prerelease]"
---

# Release a new version

Argument: the version level (`patch`, `minor`, `major`, or `prerelease`, e.g. `npm version preminor --preid beta`).
If it's missing, propose one based on the `## Next` section of `CHANGELOG.md` (new features → `minor`, only fixes →
`patch`) and ask before going on.

Remotes: `upstream` is the org repo (homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum), `origin` is
the maintainer's fork. **The release branch and the tag go to `upstream`.**

## Before starting

- Start from an up-to-date, clean `master`: `git fetch upstream && git checkout -B master upstream/master`, `git status` clean.
- Work out:
  - `PREV`: the current version in `package.json` (previous tag = `v$PREV`).
  - `NEXT`: the version after applying the level to `PREV`.
  - `DATE`: today, as `YYYY-MM-DD`.
- Check `CHANGELOG.md` has entries under `## Next`. If it's empty, stop and ask.

## 1. Changelog commit

```sh
git checkout -b $NEXT            # the branch is named after the bare version, e.g. 1.0.1
```

In `CHANGELOG.md`, keep `## Next` and add the version heading right below it, so all the unreleased entries move under
the new version:

```md
## Next

## $NEXT
```

```sh
npx prettier --check CHANGELOG.md
git commit -am "Prepare for v$NEXT"
git push -u upstream $NEXT       # needed: npm's postversion runs a bare `git push && git push --tags`
```

## 2. Version bump

```sh
npm version <level>
```

- `preversion` runs the build and the tests. If they fail, fix that first: don't skip them.
- It creates the `$NEXT` commit and the `v$NEXT` tag, and `postversion` **pushes both** to `upstream`. So the tag is
  published before the PR merges. If the PR needs more changes, the tag has to be moved.

## 3. Release PR

Title `$NEXT`, base `master`, head `$NEXT` (on `upstream`), label `release`. Body:

```md
## Description

Prepare for release of v$NEXT. It's a new <level> because:

- <the main changes, linking their PRs and issues>

## Checklist

- [x] Update the CHANGELOG.md file.
- [x] ~Add tests for the new code~ (version bump only)
- [x] Add the appropriate labels to the PR.
```

Then enable auto-merge (release PRs are squash-merged; there are no required checks, so it may merge right away):

```sh
gh pr merge <number> --auto --squash
```

## 4. After the merge

Wait for the PR to be `MERGED` (`gh pr view <number> --json state`), with a background `until` loop rather than
repeated polling.

1. **Restore the version branch.** The maintainer keeps every version branch, but GitHub deletes it after the merge:

   ```sh
   git ls-remote --heads upstream $NEXT || true    # empty = deleted
   git push upstream $NEXT:refs/heads/$NEXT
   ```

2. **Create the GitHub release.** There's no `.github/release.yml`, so write the notes from the `## $NEXT` section of
   `CHANGELOG.md` (grouped by type, e.g. "🐛 Bug fixes", "✨ New features"), ending with
   `**Full Changelog**: https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/compare/v$PREV...v$NEXT`.
   Add `--prerelease` for prereleases.

   ```sh
   gh release create v$NEXT --title "v$NEXT - $DATE" --notes-file <notes.md> --verify-tag
   ```

3. **Publishing the release publishes the package to npm** (`.github/workflows/publish-release-to-npm.yml`, Trusted
   Publishing): `latest` for releases, the prerelease identifier (or `dev`) for prereleases. Watch the run
   (`gh run list --workflow publish-release-to-npm.yml --limit 1`, then `gh run watch <id> --exit-status`) and confirm
   with `npm view homebridge-xiaomi-roborock-vacuum dist-tags`. If it fails, report it: don't publish by hand without
   asking.

4. Sync the local checkout: `git checkout master && git pull --ff-only upstream master`.

## Ask the testers / tell the reporters

Once the version is on npm:

- **Beta**: comment on the beta testers issue (#1232) mentioning the testers whose model or dock matches the
  changes. Give them a short test list (2–3 items: "turn on X, check that Y happens") and ask for ✅ / ❌ per item, with
  debug logs for ❌. Also comment on the issues the beta addresses, asking the reporters to try it.
- **Release**: comment on every issue it addresses: the version, how to enable/use it, and "if it doesn't work, comment
  here and we'll reopen it" (reporters can't reopen issues closed by a maintainer or a PR). Keep them closed: don't
  leave issues open waiting for feedback that may never come.

Report the PR, release and npm links to the user.
