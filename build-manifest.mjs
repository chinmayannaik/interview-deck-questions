/* ============================================================
   build-manifest.mjs — regenerate manifest.json from the JSON files.

   You edit questions (or add a <category>.json); this recomputes the
   tedious/derived fields so you never hand-calculate them:
     • count      — per category, from the file
     • totalQuestions
     • hash       — per file (detects ANY edit, even a same-count typo fix)
     • updatedAt  — now (only when content changed)
     • version    — auto-bumped +1 ONLY when content actually changed
                    (running it with no changes is a no-op — idempotent)

   It also validates the content and fails loudly on problems.

   You still DEFINE groups/categories in manifest.json (id, file, label,
   group, color, order). This script only fills in the derived numbers.

   Usage:  node build-manifest.mjs        (or: npm run build) No need to do this mannually we have ahook to do this.
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(dir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const DIFFICULTIES = new Set(["beginner", "intermediate", "advanced"]);
/* How the judge compares a submission's return value to `expected`:
   exact = deep equal, unordered = same items in any order, float = ±1e-5. */
const COMPARES = new Set(["exact", "unordered", "float"]);
const IDENT = /^[A-Za-z_$][\w$]*$/;
const errors = [];
const seenIds = new Map(); // id -> file (to catch duplicates across files)

const groupIds = new Set((manifest.groups || []).map((g) => g.id));
let total = 0;
const combined = createHash("sha1");

/* ---- coding categories (manifest `"mode": "coding"`) ----
   These questions are solvable in the in-app IDE, so they carry a machine-
   readable contract on top of the prose: an entry function, a starter stub, a
   reference solution and the test cases the judge runs. */

/* The same comparators js/codeedit.js uses in the browser. Kept in sync by
   hand — they are ten lines and changing one without the other would mean the
   builder passes content the judge then fails (or worse, the reverse). */
function sameAnswer(got, expected, mode) {
  if (mode === "float") return typeof got === "number" && Math.abs(got - expected) < 1e-5;
  if (mode === "unordered") {
    if (!Array.isArray(got) || !Array.isArray(expected) || got.length !== expected.length) return false;
    const a = got.map((v) => JSON.stringify(v)).sort();
    const b = expected.map((v) => JSON.stringify(v)).sort();
    return a.every((v, i) => v === b[i]);
  }
  return JSON.stringify(got) === JSON.stringify(expected);
}

function checkCoding(q, where) {
  const at = `${where} (${q.id})`;
  if (!q.problem) errors.push(`${at}: coding question needs "problem" (the statement on its own)`);
  if (!Array.isArray(q.examples) || !q.examples.length) errors.push(`${at}: needs a non-empty "examples" array`);
  else q.examples.forEach((ex, k) => {
    if (!ex || !ex.input || !ex.output) errors.push(`${at}: examples[${k}] needs both "input" and "output"`);
  });
  if (q.constraints && !Array.isArray(q.constraints)) errors.push(`${at}: "constraints" must be an array of strings`);
  if (!q.fn || !IDENT.test(q.fn)) errors.push(`${at}: "fn" must be the entry function's name`);
  if (!q.starter || !q.starter.js) errors.push(`${at}: needs "starter.js" (the stub the editor opens with)`);
  if (!q.solution || !q.solution.js) errors.push(`${at}: needs "solution.js" (the JavaScript reference solution)`);
  if (!Array.isArray(q.tests) || !q.tests.length) { errors.push(`${at}: needs a non-empty "tests" array`); return; }
  /* Convention the Solve IDE relies on: the FIRST examples.length test cases
     are the worked examples shown in the statement, and they are what "Run"
     executes. Everything after them is only reached by "Submit". Authors must
     keep that prefix aligned — the count is all that can be checked here. */
  if (Array.isArray(q.examples) && q.tests.length < q.examples.length)
    errors.push(`${at}: needs at least one test case per example (${q.examples.length} examples, ${q.tests.length} tests) — the first ${q.examples.length} must mirror them`);

  let shaped = true;
  q.tests.forEach((t, k) => {
    if (!t || !Array.isArray(t.args)) { errors.push(`${at}: tests[${k}].args must be an array of call arguments`); shaped = false; }
    else if (!("expected" in t)) { errors.push(`${at}: tests[${k}] has no "expected"`); shaped = false; }
    else if (t.compare && !COMPARES.has(t.compare)) { errors.push(`${at}: tests[${k}].compare "${t.compare}" is not one of ${[...COMPARES].join("/")}`); shaped = false; }
  });
  if (!shaped || !q.solution || !q.solution.js || !q.fn) return;

  /* Actually run the reference solution against the cases. Bad test data is the
     one content bug that punishes the *reader* — a correct submission marked
     Wrong Answer — so it must never reach the repo. Trusted, hand-authored code
     evaluated here on purpose; a solution that loops forever hangs the build,
     which is the loud failure you want. */
  let fn;
  try {
    fn = (0, eval)(`${q.solution.js}\n;(typeof ${q.fn} === "function" ? ${q.fn} : undefined);`);
  } catch (e) {
    errors.push(`${at}: solution.js threw while loading — ${e.message}`);
    return;
  }
  if (typeof fn !== "function") { errors.push(`${at}: solution.js never defines "${q.fn}"`); return; }

  q.tests.forEach((t, k) => {
    let got;
    // deep-copied args: an in-place solution (merge) would otherwise mutate the
    // very JSON we are about to hash and write back out.
    try { got = fn.apply(null, JSON.parse(JSON.stringify(t.args))); }
    catch (e) { errors.push(`${at}: tests[${k}] threw in the reference solution — ${e.message}`); return; }
    if (!sameAnswer(got, t.expected, t.compare))
      errors.push(`${at}: tests[${k}] is wrong — expected ${JSON.stringify(t.expected)}, reference solution returns ${JSON.stringify(got)}`);
  });
}

for (const cat of manifest.categories) {
  let rows;
  try {
    rows = JSON.parse(readFileSync(join(dir, cat.file), "utf8"));
  } catch (e) {
    errors.push(`${cat.file}: cannot read/parse (${e.message})`);
    continue;
  }
  if (!Array.isArray(rows)) {
    errors.push(`${cat.file}: top level must be a JSON array`);
    continue;
  }

  // validate each question
  rows.forEach((q, i) => {
    const where = `${cat.file}[${i}]`;
    if (!q.id) errors.push(`${where}: missing "id"`);
    else if (seenIds.has(q.id)) errors.push(`duplicate id "${q.id}" in ${cat.file} and ${seenIds.get(q.id)}`);
    else seenIds.set(q.id, cat.file);
    if (!q.question) errors.push(`${where} (${q.id}): missing "question"`);
    if (!q.answer) errors.push(`${where} (${q.id}): missing "answer"`);
    if (q.difficulty && !DIFFICULTIES.has(q.difficulty))
      errors.push(`${where} (${q.id}): bad difficulty "${q.difficulty}"`);
    if (q.category && q.category !== cat.id)
      errors.push(`${where} (${q.id}): category "${q.category}" != "${cat.id}"`);
    if (cat.mode === "coding") checkCoding(q, where);
  });
  if (groupIds.size && !groupIds.has(cat.group))
    errors.push(`category "${cat.id}": group "${cat.group}" is not in manifest.groups`);

  // derived fields — canonicalise the file so the hash is stable
  const canonical = JSON.stringify(rows);
  cat.count = rows.length;
  cat.hash = createHash("sha1").update(canonical).digest("hex").slice(0, 12);
  combined.update(cat.file + ":" + canonical);
  total += rows.length;
}

/* ---- packs: role-focused collections of existing questions ----
   A pack (packs/<id>.json) names whole categories plus cherry-picked
   question ids. Nothing is duplicated — the webapp resolves the pack
   against the categories it already loaded. Here we only validate the
   references and derive label/count/hash into manifest.packs. */
const catIds = new Set(manifest.categories.map((c) => c.id));
const catCount = new Map(manifest.categories.map((c) => [c.id, c.count]));
for (const packRef of manifest.packs || []) {
  let pack;
  try {
    pack = JSON.parse(readFileSync(join(dir, packRef.file), "utf8"));
  } catch (e) {
    errors.push(`${packRef.file}: cannot read/parse (${e.message})`);
    continue;
  }
  if (pack.id !== packRef.id)
    errors.push(`${packRef.file}: pack id "${pack.id}" != manifest id "${packRef.id}"`);
  const packCats = pack.categories || [];
  const packCatSet = new Set(packCats);
  packCats.forEach((c) => {
    if (!catIds.has(c)) errors.push(`${packRef.file}: unknown category "${c}"`);
  });
  let picks = 0;
  (pack.questionIds || []).forEach((id) => {
    const file = seenIds.get(id);
    if (!file) { errors.push(`${packRef.file}: unknown question id "${id}"`); return; }
    const catOfId = manifest.categories.find((c) => c.file === file);
    if (catOfId && packCatSet.has(catOfId.id))
      errors.push(`${packRef.file}: id "${id}" is redundant — its category "${catOfId.id}" is already included`);
    else picks++;
  });
  packRef.label = pack.label || packRef.id;
  packRef.count = packCats.reduce((n, c) => n + (catCount.get(c) || 0), 0) + picks;
  packRef.hash = createHash("sha1").update(JSON.stringify(pack)).digest("hex").slice(0, 12);
  combined.update(packRef.file + ":" + JSON.stringify(pack));
}

if (errors.length) {
  console.error("✗ manifest NOT written — fix these first:\n  - " + errors.join("\n  - "));
  process.exit(1);
}

const contentHash = combined.digest("hex");
const changed = manifest.contentHash !== contentHash;

manifest.totalQuestions = total;
if (changed) {
  manifest.version = (manifest.version || 0) + 1;
  manifest.updatedAt = new Date().toISOString();
  manifest.contentHash = contentHash;
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(
  changed
    ? `✔ manifest v${manifest.version} — ${total} questions across ${manifest.categories.length} categories (content changed)`
    : `✔ no content change — manifest left at v${manifest.version} (${total} questions)`
);
