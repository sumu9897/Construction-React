import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readdir, utimes, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'pm-docs-test-'));
process.env.LEDGER_ROOT = path.join(root, 'projects');

const { fileDocument, drainInbox, categorise, safeFilename, CATEGORIES } = await import(
  '../src/documents/intake.js'
);
const { scaffoldProject } = await import('../src/ledger/scaffold.js');
const { projectPaths } = await import('../src/ledger/paths.js');
const { readYaml } = await import('../src/ledger/store.js');

const CODE = 'DOC-01';
const inbox = path.join(root, 'inbox');

test.after(() => rm(root, { recursive: true, force: true }));

await scaffoldProject(CODE, { name: 'Document Test' });

// --- categorisation --------------------------------------------------------

// Assert where a document ends up, not which internal key matched - several
// synonyms deliberately route to the same folder.
const folderFor = (hint) => CATEGORIES[categorise(hint)].dir;

test('a caption routes the document to the right folder', () => {
  assert.equal(folderFor('contract'), 'contract');
  assert.equal(folderFor('the signed contract for level 3'), 'contract');
  assert.equal(folderFor('IFC drawing rev C'), 'drawings');
  assert.equal(folderFor('shop drawing A-101'), 'drawings');
  assert.equal(folderFor('minutes of the progress meeting'), 'minutes');
  assert.equal(folderFor('valuation 4'), 'commercial');
  assert.equal(folderFor('letter to the Engineer'), 'correspondence');
});

test('an unrecognised caption still files the document rather than dropping it', () => {
  assert.equal(categorise('some random thing'), 'document');
  assert.equal(categorise(''), 'document');
  assert.equal(categorise(null), 'document');
});

// --- filename safety -------------------------------------------------------

test('filenames from outside cannot escape the project folder', () => {
  // Names arrive from Telegram and from synced folders, so they are untrusted.
  assert.equal(safeFilename('../../../etc/passwd'), 'passwd');
  assert.equal(safeFilename('/absolute/path/deed.pdf'), 'deed.pdf');
  assert.equal(safeFilename('..\\..\\windows\\thing.pdf'), 'thing.pdf');
  assert.doesNotMatch(safeFilename('a/b/c.pdf'), /[/\\]/);
});

test('a dotfile name cannot be produced', () => {
  assert.equal(safeFilename('...hidden'), 'hidden');
  assert.equal(safeFilename(''), 'document');
});

test('an ordinary name survives intact', () => {
  assert.equal(safeFilename('Main Contract (signed).pdf'), 'Main Contract (signed).pdf');
});

// --- filing ----------------------------------------------------------------

test('a contract is filed into 00-contract and hashed', async () => {
  const result = await fileDocument(CODE, {
    buffer: Buffer.from('THIS IS THE CONTRACT'),
    filename: 'Main Contract.pdf',
    hint: 'contract',
    asOf: '2026-08-05',
    author: { id: 7, name: 'Nadim' },
    via: 'telegram',
  });

  assert.equal(result.status, 'filed');
  assert.equal(result.category, 'Contract');
  assert.match(result.record.file, /^00-contract\/2026-08-05-Main Contract\.pdf$/);
  // The hash is the point: it proves which revision you held, and when.
  assert.equal(result.record.sha256.length, 64);
  assert.equal(result.record.receivedFrom, 'Nadim');
  assert.equal(result.record.via, 'telegram');

  await access(path.join(projectPaths(CODE).root, result.record.file));
});

test('every document lands in one register, wherever it was filed', async () => {
  await fileDocument(CODE, {
    buffer: Buffer.from('DRAWING BYTES'),
    filename: 'A-101 Rev C.pdf',
    hint: 'drawing rev C',
    asOf: '2026-08-05',
  });

  const index = await readYaml(projectPaths(CODE).documentIndex);
  const categories = index.entries.map((e) => e.category);
  assert.ok(categories.includes('Contract'));
  assert.ok(categories.includes('Drawing'));
});

test('the identical file is not filed twice', async () => {
  // Sync folders re-deliver the same file routinely, and a contract appearing
  // three times is worse than useless.
  const buffer = Buffer.from('THIS IS THE CONTRACT');
  const result = await fileDocument(CODE, { buffer, filename: 'Main Contract.pdf', hint: 'contract' });

  assert.equal(result.status, 'duplicate');
  assert.match(result.of.file, /Main Contract\.pdf/);
});

test('a different revision with the same name does not overwrite the first', async () => {
  const result = await fileDocument(CODE, {
    buffer: Buffer.from('THIS IS THE CONTRACT, REVISED'),
    filename: 'Main Contract.pdf',
    hint: 'contract',
    asOf: '2026-08-05',
  });

  assert.equal(result.status, 'filed');
  assert.match(result.record.file, /Main Contract-2\.pdf$/);

  const files = await readdir(projectPaths(CODE).contract);
  assert.equal(files.filter((f) => f.includes('Main Contract')).length, 2);
});

// --- inbox -----------------------------------------------------------------

/** Backdate a file so the "still being written" guard does not skip it. */
async function settle(file) {
  const old = new Date(Date.now() - 120_000);
  await utimes(file, old, old);
}

test('the inbox files everything dropped in it, using folder names as categories', async () => {
  await mkdir(path.join(inbox, CODE, 'correspondence'), { recursive: true });
  await mkdir(path.join(inbox, CODE, 'minutes'), { recursive: true });

  const letter = path.join(inbox, CODE, 'correspondence', 'Engineer letter 12.pdf');
  const mom = path.join(inbox, CODE, 'minutes', 'Progress meeting 8.docx');
  await writeFile(letter, 'LETTER');
  await writeFile(mom, 'MINUTES');
  await settle(letter);
  await settle(mom);

  const result = await drainInbox(CODE, inbox, { author: { id: 1, name: 'Sync' } });

  assert.equal(result.filed.length, 2);
  const categories = result.filed.map((f) => f.category).sort();
  assert.deepEqual(categories, ['Correspondence', 'Minutes']);

  // Removed only after a successful write, so a crash never loses the file.
  assert.equal((await readdir(path.join(inbox, CODE, 'minutes'))).length, 0);
});

test('a file still being written is left alone until it settles', async () => {
  await mkdir(path.join(inbox, CODE), { recursive: true });
  const partial = path.join(inbox, CODE, 'half-uploaded.pdf');
  await writeFile(partial, 'INCOMPLETE');
  // Deliberately not backdated - it looks like a sync in progress.

  const result = await drainInbox(CODE, inbox);

  assert.equal(result.filed.length, 0);
  assert.equal(result.skipped[0].reason, 'still being written');
  // Filing it half-written would fix a wrong hash into the record forever.
  await access(partial);
});

test('an empty file is skipped rather than filed', async () => {
  const empty = path.join(inbox, CODE, 'empty.pdf');
  await writeFile(empty, '');
  await settle(empty);

  const result = await drainInbox(CODE, inbox);
  assert.ok(result.skipped.some((s) => s.file === 'empty.pdf' && s.reason === 'empty'));
});

test('an inbox that does not exist is not an error', async () => {
  const result = await drainInbox('NO-SUCH-PROJECT', inbox);
  assert.deepEqual(result.filed, []);
});

test('--keep leaves the original in place', async () => {
  const keeper = path.join(inbox, CODE, 'keep-me.pdf');
  await writeFile(keeper, 'KEEP');
  await settle(keeper);

  await drainInbox(CODE, inbox, { keep: true });
  await access(keeper);
});
