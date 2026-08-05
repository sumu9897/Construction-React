import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMspdiText, parseXsdDuration, parseXml, decodeMspdi } from '../src/parse/mspdi.js';
import { parseXerText } from '../src/parse/xer.js';
import { normalizeProgramme } from '../src/parse/normalize.js';
import { makeMspdi } from './fixtures/make-mspdi.js';
import { makeXer, BASE_PROGRAMME } from './fixtures/make-xer.js';

const parse = (spec) => parseMspdiText(makeMspdi(spec), { projectCode: spec.projectCode });

// --- Unit conversions: the places MSPDI silently corrupts numbers ------------

test('xsd durations read as hours', () => {
  assert.equal(parseXsdDuration('PT200H0M0S'), 200);
  assert.equal(parseXsdDuration('PT8H30M0S'), 8.5);
  assert.equal(parseXsdDuration('PT0H0M0S'), 0);
  assert.equal(parseXsdDuration(''), null);
  assert.equal(parseXsdDuration(null), null);
});

test('slack arrives in tenths of minutes and comes out in days', () => {
  // 2 days on an 8h calendar = 16h = 960min = 9600 tenths.
  const programme = parse({
    ...BASE_PROGRAMME,
    activities: [{ code: 'A-1', name: 'X', durationDays: 5, totalFloatDays: 2 }],
  });
  assert.equal(programme.activities[0].totalFloatDays, 2);
});

test('a 10-hour day divides durations differently than an 8-hour one', () => {
  const programme = parse({
    ...BASE_PROGRAMME,
    hoursPerDay: 10,
    activities: [{ code: 'A-1', name: 'X', durationDays: 5, totalFloatDays: 3 }],
  });
  assert.equal(programme.activities[0].durationDays, 5);
  assert.equal(programme.activities[0].totalFloatDays, 3);
});

test('costs are stored in hundredths and reported in currency units', () => {
  const xml = makeMspdi({
    ...BASE_PROGRAMME,
    activities: [{ code: 'A-1', name: 'X', durationDays: 5 }],
  }).replace('<CalendarUID>1</CalendarUID>', '<CalendarUID>1</CalendarUID><Cost>1250000</Cost>');
  const programme = parseMspdiText(xml);
  assert.equal(programme.activities[0].budgetCost, 12500);
});

// --- Parity: one scenario, two schedulers, same answers ----------------------

test('the four checked numbers match the XER parser on the same programme', () => {
  const fromXer = normalizeProgramme(parseXerText(makeXer(BASE_PROGRAMME)), {
    projectCode: 'TEST-01',
  });
  const fromMspdi = parse(BASE_PROGRAMME);

  assert.equal(fromMspdi.stats.activityCount, fromXer.stats.activityCount);
  assert.equal(fromMspdi.project.dataDateDay, fromXer.project.dataDateDay);
  assert.equal(fromMspdi.stats.criticalCount, fromXer.stats.criticalCount);
  assert.equal(fromMspdi.stats.forecastFinish, fromXer.stats.forecastFinish);
});

test('per-activity fields agree with the XER parser', () => {
  const fromXer = normalizeProgramme(parseXerText(makeXer(BASE_PROGRAMME)), {
    projectCode: 'TEST-01',
  });
  const fromMspdi = parse(BASE_PROGRAMME);

  const xerByName = new Map(fromXer.activities.map((a) => [a.name, a]));
  for (const activity of fromMspdi.activities) {
    const other = xerByName.get(activity.name);
    assert.ok(other, `activity ${activity.name} missing from XER parse`);
    assert.equal(activity.status, other.status, `${activity.name} status`);
    assert.equal(activity.percentComplete, other.percentComplete, `${activity.name} percent`);
    assert.equal(activity.totalFloatDays, other.totalFloatDays, `${activity.name} float`);
    assert.equal(activity.critical, other.critical, `${activity.name} critical`);
    assert.equal(activity.remainingDays, other.remainingDays, `${activity.name} remaining`);
  }
  assert.equal(fromMspdi.stats.relationshipCount, fromXer.stats.relationshipCount);
});

// --- MSPDI-specific behaviour ------------------------------------------------

test('summary tasks become WBS nodes, not activities', () => {
  const xml = `<?xml version="1.0"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>T</Name><MinutesPerDay>480</MinutesPerDay>
  <StatusDate>2026-07-01T00:00:00</StatusDate>
  <Tasks>
    <Task><UID>0</UID><OutlineLevel>0</OutlineLevel><Summary>1</Summary><Name>T</Name></Task>
    <Task><UID>1</UID><OutlineLevel>1</OutlineLevel><Summary>1</Summary><Name>Structure</Name></Task>
    <Task><UID>2</UID><OutlineLevel>2</OutlineLevel><Summary>0</Summary><Name>Slab</Name>
      <Duration>PT40H0M0S</Duration><PercentComplete>0</PercentComplete></Task>
    <Task><UID>3</UID><OutlineLevel>1</OutlineLevel><Summary>1</Summary><Name>MEP</Name></Task>
    <Task><UID>4</UID><OutlineLevel>2</OutlineLevel><Summary>0</Summary><Name>First fix</Name>
      <Duration>PT80H0M0S</Duration><PercentComplete>0</PercentComplete></Task>
  </Tasks>
</Project>`;
  const programme = parseMspdiText(xml);
  assert.equal(programme.stats.activityCount, 2);
  assert.deepEqual(programme.wbs.map((w) => w.name), ['Structure', 'MEP']);
  assert.equal(programme.activities[0].wbsPath, 'Structure');
  assert.equal(programme.activities[1].wbsPath, 'MEP');
});

test('inactive and null tasks are not part of the programme', () => {
  const xml = `<?xml version="1.0"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>T</Name><StatusDate>2026-07-01T00:00:00</StatusDate>
  <Tasks>
    <Task><UID>1</UID><OutlineLevel>1</OutlineLevel><Summary>0</Summary><Name>Real</Name>
      <PercentComplete>0</PercentComplete></Task>
    <Task><UID>2</UID><OutlineLevel>1</OutlineLevel><Summary>0</Summary><Name>Inactive</Name>
      <Active>0</Active><PercentComplete>0</PercentComplete></Task>
    <Task><UID>3</UID><IsNull>1</IsNull></Task>
  </Tasks>
</Project>`;
  const programme = parseMspdiText(xml);
  assert.deepEqual(programme.activities.map((a) => a.name), ['Real']);
});

test('milestones and hard constraints survive the trip', () => {
  const programme = parse(BASE_PROGRAMME);
  const milestone = programme.activities.find((a) => a.name === 'Practical completion');
  assert.equal(milestone.type, 'finish-milestone');

  const constrained = parse({
    ...BASE_PROGRAMME,
    activities: [
      {
        code: 'M-1', name: 'PC', type: 'TT_FinMile', durationDays: 0,
        planStart: '2026-12-18', planFinish: '2026-12-18',
        constraint: 'CS_MANDFIN', constraintDate: '2026-12-18',
      },
    ],
  });
  assert.equal(constrained.activities[0].constraintType, 'Must Finish On');
  assert.equal(constrained.activities[0].constraintIsHard, true);
});

test('percent lag is recorded as zero, never as a fabricated day count', () => {
  const xml = `<?xml version="1.0"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>T</Name><StatusDate>2026-07-01T00:00:00</StatusDate>
  <Tasks>
    <Task><UID>1</UID><OutlineLevel>1</OutlineLevel><Summary>0</Summary><Name>A</Name>
      <PercentComplete>0</PercentComplete></Task>
    <Task><UID>2</UID><OutlineLevel>1</OutlineLevel><Summary>0</Summary><Name>B</Name>
      <PercentComplete>0</PercentComplete>
      <PredecessorLink><PredecessorUID>1</PredecessorUID><Type>1</Type>
        <LinkLag>5000</LinkLag><LagFormat>19</LagFormat></PredecessorLink>
    </Task>
  </Tasks>
</Project>`;
  const programme = parseMspdiText(xml);
  assert.equal(programme.relationships[0].lagDays, 0);
});

test('activity names with ampersands and accents read back exactly', () => {
  const programme = parse({
    ...BASE_PROGRAMME,
    activities: [{ code: 'A-1', name: 'Façade & <cladding>', durationDays: 5 }],
  });
  assert.equal(programme.activities[0].name, 'Façade & <cladding>');
});

test('a UTF-16 export decodes', () => {
  const xml = makeMspdi({
    ...BASE_PROGRAMME,
    activities: [{ code: 'A-1', name: 'Façade', durationDays: 5 }],
  });
  const utf16 = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(xml, 'utf16le'),
  ]);
  const programme = parseMspdiText(decodeMspdi(utf16));
  assert.equal(programme.activities[0].name, 'Façade');
});

test('refuses a file that is not MSPDI', () => {
  assert.throws(() => parseMspdiText('<html><body>hi</body></html>'), /no <Project>/);
});

test('the XML reader handles CDATA and self-closing tags', () => {
  const doc = parseXml('<a><b><![CDATA[x < y]]></b><c/><d>t</d></a>');
  const a = doc.children[0];
  assert.equal(a.children[0].text, 'x < y');
  assert.equal(a.children[1].name, 'c');
  assert.equal(a.children[2].text, 't');
});
