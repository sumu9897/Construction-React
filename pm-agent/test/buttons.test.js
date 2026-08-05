import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'pm-agent-buttons-'));
process.env.LEDGER_ROOT = path.join(root, 'projects');
process.env.TELEGRAM_ALLOWED_CHAT_IDS = '42';

const { keyboard } = await import('../src/bot/telegram.js');
const { RESPONSIBILITY_BUTTONS, classifyResponsibility } = await import('../src/bot/chase.js');
const { asMessage } = await import('../src/bot/server.js');

test.after(() => rm(root, { recursive: true, force: true }));

test('keyboard wraps labels and prefixes the text a press stands for', () => {
  const markup = keyboard([[{ label: 'Switch', send: '/project BCHARREH' }]]);
  const button = markup.reply_markup.inline_keyboard[0][0];
  assert.equal(button.text, 'Switch');
  assert.equal(button.callback_data, 't:/project BCHARREH');
});

test('callback data never exceeds the Telegram 64-byte cap', () => {
  const markup = keyboard([[{ label: 'X', send: 'y'.repeat(200) }]]);
  assert.ok(markup.reply_markup.inline_keyboard[0][0].callback_data.length <= 64);
});

test('every responsibility button classifies as the side it names', () => {
  // The invariant that makes buttons safe: a tap must land in the same bucket
  // a typed answer with that word would. If this breaks, a button press
  // silently records the wrong party against a delay event.
  const [row1, row2] = RESPONSIBILITY_BUTTONS;
  assert.equal(classifyResponsibility(row1[0].send), 'employer');
  assert.equal(classifyResponsibility(row1[1].send), 'contractor');
  assert.equal(classifyResponsibility(row2[0].send), 'neutral');
});

function fakeTg() {
  const calls = [];
  return {
    calls,
    answerCallbackQuery: async (id) => calls.push(['ack', id]),
    clearButtons: async (chatId, messageId) => calls.push(['clear', chatId, messageId]),
  };
}

test('a button press becomes the message it stands for', async () => {
  const tg = fakeTg();
  const message = await asMessage(tg, {
    id: 'cq1',
    data: 't:consultant',
    from: { id: 42, first_name: 'Nadim' },
    message: { message_id: 7, chat: { id: 42 } },
  });

  assert.deepEqual(message, { chat: { id: 42 }, from: { id: 42, first_name: 'Nadim' }, text: 'consultant' });
  // Acknowledged and de-buttoned, so a double-tap cannot answer twice.
  assert.deepEqual(tg.calls, [['ack', 'cq1'], ['clear', 42, 7]]);
});

test('a press with unrecognised data is acknowledged and dropped', async () => {
  const tg = fakeTg();
  const message = await asMessage(tg, {
    id: 'cq2',
    data: 'legacy-format',
    from: { id: 42 },
    message: { message_id: 8, chat: { id: 42 } },
  });
  assert.equal(message, null);
  assert.deepEqual(tg.calls, [['ack', 'cq2']]);
});

test('no callback query maps to no message', async () => {
  assert.equal(await asMessage(fakeTg(), undefined), null);
});
