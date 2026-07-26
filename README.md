# Shared Data

This folder contains all interview questions used by both the **website** and the **Flutter app**.

<img width="1482" height="753" alt="image" src="https://github.com/user-attachments/assets/566f8855-95f8-4c3a-9209-bd84e0378802" />


Question content is stored only here. Firebase stores only user data such as progress, bookmarks, and notes.

<p align="center">
  <a href="https://interview-questions-bank.netlify.app/">
    <img src="https://img.shields.io/badge/Live-Demo-C21836?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Live Demo">
  </a>
</p>

## Contributing

1. Create a new branch from `main`.
2. Make your changes.
3. Commit your changes.
4. Push your branch.
5. Raise a Pull Request (PR).

## Files

- `manifest.json` – Categories and content metadata.
- `<category>.json` – Questions for each category (e.g. `angular.json`, `git.json`).

---

## Updating Questions

1. Open the required `<category>.json`.
2. Add, edit, or remove questions.
3. Commit and push.

A Git hook automatically:
- Updates `version`
- Updates `updatedAt`
- Updates `totalQuestions`
- Updates category `count`
- Validates the content before the push

> **Do not manually edit** `version`, `updatedAt`, `count`, or `totalQuestions`.

---

## Adding a New Category

1. Create a new JSON file (e.g. `flutter.json`).
2. Add it to `manifest.json`.

Example:

```json
{
  "id": "flutter",
  "file": "flutter.json",
  "label": "Flutter",
  "group": "mobile"
}
```

Commit and push.

---

## Adding a New Group

Example:

```json
{
  "id": "mobile",
  "label": "Mobile Development",
  "color": "#02569B"
}
```

Then add one or more categories that belong to the group.

---

## Question Format

```json
{
  "id": "angular-components",
  "category": "angular",
  "difficulty": "beginner",
  "tags": ["components"],
  "question": "What is a component?",
  "revise": "1–2 line crisp recap for Revise Mode.",
  "answer": "<p>...</p>",
  "tip": "Optional",
  "code": "",
  "lang": "",
  "deep": "<p>...</p>"
}
```

---

## Revise Mode & the `revise` field

The app/website has two reading modes:

- **Preparation Mode** — first-time / deep learning. Shows everything: `answer`, `deep`, `code`, `tip`, `youtube`.
- **Revise Mode** — quick refresh before an interview. Tapping a question reveals **only** the `revise` text. Each card also carries a small **Prep / Revise** toggle (the same segmented control as the header): flipping it to **Prep** expands that one card's full `answer` inline, without leaving Revise Mode.

**Writing a good `revise` value:**

- Keep it to **1–2 lines**, plain text, no fluff — the "5-second jolt", not a paragraph.
- It must be a **genuine compression**, not a sentence copy-pasted from `answer`. Prefer keyword/trigger phrasing.
  - ❌ *"var is function-scoped, hoisted and initialised to undefined…"* (duplicates `answer`)
  - ✅ *"var → func-scope, hoist=undefined. let/const → block-scope, hoist=TDZ. const = binding fixed, value mutable."*

**Fallback when `revise` is missing:** Revise Mode falls back to `tip`, then to a truncated `answer` — so existing questions still work and `revise` can be backfilled gradually.

> `revise` is optional. `tip` remains a separate field (surfaced in Preparation Mode) — do **not** merge the two.

---

## Notes

- Every `id` must be unique.
- `category` must match a category in `manifest.json`.
- `difficulty` must be `beginner`, `intermediate`, or `advanced`.
- The order of `groups` and `categories` in `manifest.json` determines the display order in both the website and the app.
