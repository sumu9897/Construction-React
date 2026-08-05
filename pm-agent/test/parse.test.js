import test from 'node:test';
import assert from 'node:assert/strict';

import { parseXerText, decodeXer } from '../src/parse/xer.js';
import { normalizeProgramme } from '../src/parse/normalize.js';
import { makeXer, BASE_PROGRAMME } from './fixtures/make-xer.js';

const text = makeXer(BASE_PROGRAMME);
const raw = parseXerText(text);
const programme = normalizeProgramme(raw, { sourceFile: 'base.xer' });

const byCode = (code) => programme.activities.find((a) => a.code === code);

test('parses the XER header', () => {
  assert.equal(raw.header.version, '19.12');
  assert.equal(raw.header.currency, 'USD');
});

test('parses every table and row', () => {
  assert.equal(raw.tables.TASK.rows.length, 6);
  assert.equal(raw.tables.TASKPRED.rows.length, 5);
  assert.equal(raw.tables.PROJWBS.rows.length, 3);
});

test('rejects a file that is not an XER', () => {
  assert.throws(() => parseXerText('just some text\n'), /no ERMHDR/);
});

test('decodes Windows-1252, which is what P6 actually writes', () => {
  // 0xE9 is "e-acute" in cp1252 and invalid on its own in UTF-8.
  const buffer = Buffer.from([...Buffer.from('ERMHDR\t19.12\tCaf'), 0xe9]);
  assert.match(decodeXer(buffer), /Café/);
});

test('honours a UTF-8 BOM when a third-party tool wrote the file', () => {
  const buffer = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from('ERMHDR\t19.12\tCafé', 'utf8'),
  ]);
  assert.match(decodeXer(buffer), /Café/);
});

test('converts float and duration from P6 hours into days using the calendar', () => {
  // A-1240 has 2 days float on an 8h calendar, stored as 16 hours.
  assert.equal(byCode('A-1240').totalFloatDays, 2);
  assert.equal(byCode('A-1240').durationDays, 25);
  assert.equal(byCode('A-1240').remainingDays, 12);
});

test('resolves the WBS path', () => {
  assert.equal(byCode('A-1240').wbsPath, 'Structure');
  assert.equal(byCode('A-1300').wbsPath, 'MEP');
});

test('reads percent complete against the activity own basis', () => {
  const activity = byCode('A-1240');
  assert.equal(activity.percentComplete, 52);
  assert.equal(activity.percentBasis, 'physical');
});

test('falls back to duration basis when that is what P6 says to use', () => {
  const programmeDrtn = normalizeProgramme(
    parseXerText(
      makeXer({
        ...BASE_PROGRAMME,
        activities: [
          {
            code: 'A-1', name: 'Duration based', status: 'TK_Active',
            percentType: 'CP_Drtn', durationDays: 10, remainingDays: 4,
            planStart: '2026-06-01', planFinish: '2026-06-12', totalFloatDays: 5,
          },
        ],
        relationships: [],
      }),
    ),
  );
  const activity = programmeDrtn.activities[0];
  assert.equal(activity.percentBasis, 'duration');
  assert.equal(activity.percentComplete, 60);
});

test('maps relationship types and lags', () => {
  const link = programme.relationships.find(
    (r) => r.predecessorId === byCode('A-1240').id && r.successorId === byCode('A-1300').id,
  );
  assert.equal(link.type, 'SS');
  assert.equal(link.lagDays, 5);
});

test('drops relationships pointing outside the project', () => {
  // All five fixture links are internal, so none should be lost.
  assert.equal(programme.relationships.length, 5);
});

test('reads status, actuals and criticality', () => {
  assert.equal(byCode('A-1000').status, 'complete');
  assert.equal(byCode('A-1240').status, 'in-progress');
  assert.equal(byCode('A-1400').status, 'not-started');
  assert.equal(byCode('A-1240').actualStart, '2026-06-03T08:00:00');
  assert.equal(byCode('A-1240').critical, true);
  assert.equal(byCode('A-1400').critical, false);
});

test('reads the data date and derives the forecast completion', () => {
  assert.equal(programme.project.dataDateDay, '2026-07-01');
  // Latest finish in the programme is the practical completion milestone.
  assert.equal(programme.stats.forecastFinish.slice(0, 10), '2026-12-18');
});

test('counts activities by status', () => {
  assert.equal(programme.stats.activityCount, 6);
  assert.equal(programme.stats.complete, 2);
  assert.equal(programme.stats.inProgress, 1);
  assert.equal(programme.stats.notStarted, 3);
});

test('picks the project that actually owns activities', () => {
  // A file where the first PROJECT row is an empty linked shell.
  const withShell = text.replace(
    '%R\t1\tTEST-01',
    '%R\t99\tEMPTY-SHELL\t\t\t\t\n%R\t1\tTEST-01',
  );
  const parsed = normalizeProgramme(parseXerText(withShell));
  assert.equal(parsed.project.code, 'TEST-01');
  assert.equal(parsed.stats.activityCount, 6);
});
