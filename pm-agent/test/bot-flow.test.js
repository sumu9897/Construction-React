/**
 * Whole exchanges, driven against a fake Telegram.
 *
 * The unit tests cover what the parsers decide; these cover what the user
 * actually sees come back, because a conversation that is individually correct
 * at every step can still be unusable.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Records everything sent, and answers nothing. */
function fakeTelegram() {
  const sent = [];
  return {
    sent,
    last: () => sent.at(-1),
    text: () => sent.map((s) => s.text).join('\n---\n'),
    buttons: () =>
      (sent.at(-1)?.options?.reply_markup?.inline_keyboard ?? []).flat().map((b) => b.text),
    async send(chatId, text, options = {}) {
      sent.push({ chatId, text, options });
    },
    async sendDocument(chatId, name, _buffer, caption) {
      sent.push({ chatId, text: `[document ${name}] ${caption ?? ''}`, document: name });
    },
    async call() {
      return {};
    },
  };
}

const AUTHOR = { id: 42, name: 'Nadim (test)' };
const CHAT = 42;

async function project(contract = {}, registers = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'pm-botflow-'));
  process.env.LEDGER_ROOT = path.join(root, 'projects');

  const { scaffoldProject } = await import('../src/ledger/scaffold.js');
  const { writeYaml, readYaml } = await import('../src/ledger/store.js');
  const { projectPaths } = await import('../src/ledger/paths.js');

  await scaffoldProject('TESTPRJ', { name: 'Test Project' });
  const paths = projectPaths('TESTPRJ');

  const config = await readYaml(paths.config);
  config.contract = { ...config.contract, ...contract };
  await writeYaml(paths.config, config);

  for (const [key, value] of Object.entries(registers)) {
    await writeYaml(paths[key], value);
  }

  return { root, paths };
}

async function run(tg, text, state) {
  const { _internals } = await import('../src/bot/server.js');
  await _internals.handleCommand(tg, CHAT, text, state, AUTHOR);
  return tg;
}

// --- /log ------------------------------------------------------------------

test('/log holds the words, asks what kind of thing it is, then files it', async () => {
  const { root } = await project();
  const state = { activeProject: 'TESTPRJ', chats: {} };
  const tg = fakeTelegram();

  await run(tg, '/log order the ridge tiles owner Jihad due 1 aug 2026', state);

  assert.match(tg.last().text, /order the ridge tiles/);
  assert.match(tg.last().text, /What is this\?/);
  assert.deepEqual(tg.buttons(), ['⚠️ Risk', '⚖️ Decision needed', '📌 Action']);
  // Nothing is written until the register is known.
  assert.equal(state.chats[CHAT].pendingCapture, 'order the ridge tiles owner Jihad due 1 aug 2026');

  await run(tg, '/logas action', state);

  const filed = tg.last().text;
  assert.match(filed, /ACT-001/);
  assert.match(filed, /order the ridge tiles/);
  assert.match(filed, /Owner: Jihad/);
  assert.match(filed, /Due: 1 Aug 2026/);
  assert.equal(state.chats[CHAT].pendingCapture, undefined, 'the held text is consumed');

  await rm(root, { recursive: true, force: true });
});

test('/logas with nothing held says so rather than filing an empty entry', async () => {
  const { root } = await project();
  const state = { activeProject: 'TESTPRJ', chats: {} };
  const tg = fakeTelegram();

  await run(tg, '/logas action', state);
  assert.match(tg.last().text, /Nothing waiting to be filed/);

  await rm(root, { recursive: true, force: true });
});

test('a bare /log teaches the shape without filing anything', async () => {
  const { root } = await project();
  const state = { activeProject: 'TESTPRJ', chats: {} };
  const tg = fakeTelegram();

  await run(tg, '/log', state);
  assert.match(tg.last().text, /Record something/);
  assert.equal(state.chats?.[CHAT]?.pendingCapture, undefined);

  await rm(root, { recursive: true, force: true });
});

// --- buttons that fill in what is missing ----------------------------------

test('a missing owner comes back as buttons, and one fills it in', async () => {
  const { root } = await project();
  const state = { activeProject: 'TESTPRJ', chats: {} };
  const tg = fakeTelegram();

  await run(tg, '/action pour the raft slab', state);
  assert.match(tg.last().text, /No owner or due recorded/);
  assert.ok(tg.buttons().includes('👤 Client'), 'expected owner buttons');

  await run(tg, '/set ACT-001 owner Client', state);
  assert.match(tg.last().text, /owner set to \*Client\*/);
  // Still no date, so the date buttons remain.
  assert.ok(tg.buttons().some((b) => b.startsWith('📅')), 'expected due buttons to remain');

  await rm(root, { recursive: true, force: true });
});

test('an unreadable date is refused rather than stored', async () => {
  const { root } = await project();
  const state = { activeProject: 'TESTPRJ', chats: {} };
  const tg = fakeTelegram();

  await run(tg, '/action order the lime', state);
  await run(tg, '/set ACT-001 due when the client decides', state);

  assert.match(tg.last().text, /could not read/i);

  const { readYaml } = await import('../src/ledger/store.js');
  const { projectPaths } = await import('../src/ledger/paths.js');
  const register = await readYaml(projectPaths('TESTPRJ').actions);
  assert.equal(register.entries[0].dueDate, undefined, 'nothing plausible was invented');

  await rm(root, { recursive: true, force: true });
});

// --- /contract and /today --------------------------------------------------

test('/contract states the terms, the exposure and what is not being watched', async () => {
  const { root } = await project(
    {
      form: 'Bespoke lump-sum',
      sum: 1_000_000,
      currency: 'USD',
      completionDate: '2026-11-27',
      ldPerDay: 1000,
      ldCapPercent: 5,
      delayNoticeDays: 14,
      delayNoticeClause: 'Art. 9.2',
      // particularsDays deliberately left null.
      particularsDays: null,
    },
    {
      events: {
        entries: [
          { ref: 'EV-001', date: '2026-07-21', responsibility: 'employer', status: 'open', description: 'Permit stoppage' },
        ],
      },
    },
  );

  const state = { activeProject: 'TESTPRJ', chats: {} };
  const tg = fakeTelegram();
  await run(tg, '/contract', state);

  const out = tg.text();
  assert.match(out, /Bespoke lump-sum/);
  assert.match(out, /USD 1,000,000/);
  assert.match(out, /Art\. 9\.2/, 'the configured clause is cited');
  assert.match(out, /Not set, so not watched/);
  assert.match(out, /particulars period/, 'the unset term is named');

  await rm(root, { recursive: true, force: true });
});

test('/today answers with one screen even before a programme exists', async () => {
  const { root } = await project();
  const state = { activeProject: 'TESTPRJ', chats: {} };
  const tg = fakeTelegram();

  await run(tg, '/today', state);

  assert.match(tg.last().text, /No programme ingested yet/);
  assert.ok(tg.buttons().includes('🎙 Site update'), 'offers the next step');

  await rm(root, { recursive: true, force: true });
});

// --- the menu is the promise -----------------------------------------------

test('every command the menu offers is one the bot answers', async () => {
  const { root } = await project();
  const { COMMAND_MENU, _internals } = await import('../src/bot/server.js');
  const state = { activeProject: 'TESTPRJ', chats: {} };

  for (const entry of COMMAND_MENU) {
    const tg = fakeTelegram();
    const handled = await _internals.handleCommand(tg, CHAT, `/${entry.command}`, state, AUTHOR);
    assert.ok(handled, `/${entry.command} is on the menu but is not handled`);
  }

  await rm(root, { recursive: true, force: true });
});

test('every button on every panel maps to a command the bot answers', async () => {
  const { root } = await project();
  const { _internals, CAPTURE_BUTTONS } = await import('../src/bot/server.js');
  const state = { activeProject: 'TESTPRJ', chats: {} };

  const sends = [..._internals.MENU_ROWS, ..._internals.MORE_ROWS, ...CAPTURE_BUTTONS]
    .flat()
    .map((b) => b.send);

  for (const send of sends) {
    const tg = fakeTelegram();
    const handled = await _internals.handleCommand(tg, CHAT, send, state, AUTHOR);
    assert.ok(handled, `a button sends ${send}, which nothing handles`);
  }

  await rm(root, { recursive: true, force: true });
});
