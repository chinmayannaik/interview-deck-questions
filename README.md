# shared-data — the single source of truth

This folder holds **all interview questions** as JSON. Both the website and the
Flutter Android app read from these exact files. Nothing else stores question
content (Firebase stores only *user* data — progress, bookmarks, notes).

## Files

- `manifest.json` — content version, timestamp, and the list of categories.
- `<category>.json` — one file per category (e.g. `angular.json`, `git.json`).

## Editing content (typo fix / new question / better answer)

**Do NOT hand-edit `count`, `version`, `updatedAt` or `totalQuestions`.** A script
computes them for you:

1. Edit the relevant `<category>.json` (or add a new object to the array).
2. Commit + push. Website and app pick it up automatically (see the webapp's
   ARCHITECTURE.md).

The builder will **validates** the content (JSON parses, ids unique, required
fields present, difficulty valid, group exists) and refuses to write a broken
manifest — so a bad edit fails locally instead of shipping.

> Only `version` and `count` are functionally required (they drive the app's
> re-download); the builder guarantees they're always correct.

## Structure is data-driven — add a field or section from git alone

Both the **main fields** (`groups`) and the **sections** (`categories`) are
defined in `manifest.json`. The website and app read them from there, so adding
one is a content-only change — **no app release, no website redeploy**.

**Add a new main field** (e.g. "Mobile Development" after DevOps):
1. Add an entry to `groups` in `manifest.json` at the position you want it shown:
   ```json
   { "id": "mobile", "label": "Mobile Development", "color": "#02569B" }
   ```
2. Add at least one category that references it (see below). A group with no
   questions is hidden until it has some.
3. Run `node build-manifest.mjs`, then push.

**Add a new section** (category) under any field:
1. Create `<category>.json` (an array of questions using the same schema).
2. Add an entry to `categories` in `manifest.json` (omit `count` — the builder
   fills it):
   ```json
   { "id": "mobile", "file": "mobile.json", "label": "Mobile",
     "group": "mobile", "color": "#02569B" }
   ```
   - `group` is the id of the parent field (must exist in `groups`).
   - `color` is optional — omit it and the clients auto-assign one.
3. then push.

Order matters: the order of entries in `groups` and `categories` is the display
order in both clients.

## Question schema

```jsonc
{
  "id": "git-merge-rebase",        // globally unique, stable — never reuse
  "category": "git",               // must equal the manifest category id
  "difficulty": "intermediate",    // beginner | intermediate | advanced
  "tags": ["merge", "rebase"],     // string[]
  "question": "Merge vs rebase.",  // plain text
  "answer": "<p>…</p>",            // trusted HTML (rendered as markup)
  "tip": "Don't rebase shared branches.", // optional plain text
  "code": "git rebase main",       // optional code sample ("" if none)
  "lang": "bash",                  // optional language hint ("" if none)
  "deep": "<p>…</p>"               // optional in-depth HTML (omit if absent)
}
```

## Regenerating from the legacy JS (one-off)

The JSON was generated from the old `data/*.js` files with
`node scripts/migrate-to-json.js`. That script is kept for reference only —
**JSON is now the source of truth**; do not edit `data/*.js`.
