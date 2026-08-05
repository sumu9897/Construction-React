import test from 'node:test';
import assert from 'node:assert/strict';

import {
  contractPosition,
  delayDamagesExposure,
  formatContract,
  CONTRACT_TERMS,
} from '../src/analysis/contract.js';

const ASOF = '2026-07-30';

const CONTRACT = {
  form: 'Bespoke lump-sum renovation agreement',
  sum: 1_450_000,
  currency: 'USD',
  completionDate: '2026-11-27',
  ldPerDay: 1500,
  ldCapPercent: 5,
  retentionPercent: 10,
  delayNoticeDays: 14,
  particularsDays: 28,
  rfiResponseDays: 7,
  submittalResponseDays: 14,
  delayNoticeClause: 'Art. 9.2',
  ldClause: 'Art. 11.1',
  rfiClause: 'Art. 5.4',
};

const programme = (forecastFinish) => ({ stats: { forecastFinish } });

// --- delay damages ---------------------------------------------------------

test('states exposure as days beyond the contract date times the recorded rate', () => {
  const d = delayDamagesExposure({ contract: CONTRACT, forecastFinish: '2026-12-02' });
  assert.equal(d.days, 5);
  assert.equal(d.gross, 7500);
  assert.equal(d.amount, 7500);
  assert.equal(d.capped, false);
});

test('applies the cap as written rather than the gross figure', () => {
  // 200 days at 1500 is 300k; the cap is 5% of 1.45m = 72.5k.
  const d = delayDamagesExposure({ contract: CONTRACT, forecastFinish: '2027-06-15' });
  assert.ok(d.gross > d.cap);
  assert.equal(d.cap, 72_500);
  assert.equal(d.amount, 72_500);
  assert.equal(d.capped, true);
});

test('inside the contract date is zero exposure, not a negative one', () => {
  const d = delayDamagesExposure({ contract: CONTRACT, forecastFinish: '2026-11-01' });
  assert.ok(d.days < 0);
  assert.equal(d.amount, 0);
});

test('no rate recorded means no figure is stated', () => {
  const d = delayDamagesExposure({
    contract: { ...CONTRACT, ldPerDay: null },
    forecastFinish: '2026-12-02',
  });
  assert.equal(d, null);
});

test('no contract completion date means nothing can be measured as late', () => {
  const d = delayDamagesExposure({
    contract: { ...CONTRACT, completionDate: null },
    forecastFinish: '2026-12-02',
  });
  assert.equal(d, null);
});

// --- notices ---------------------------------------------------------------

test('runs the notice clock on the other side’s events, never on our own', () => {
  const events = {
    entries: [
      { ref: 'EV-002', date: '2026-07-21', responsibility: 'employer', status: 'open', description: 'Permit stoppage' },
      { ref: 'EV-001', date: '2026-07-14', responsibility: 'contractor', status: 'open', description: 'Our crew left' },
    ],
  };

  const { exposures } = contractPosition({ contract: CONTRACT, programme: programme(null), events, asOf: ASOF });
  const refs = exposures.filter((e) => e.kind === 'notice').map((e) => e.ref);

  assert.deepEqual(refs, ['EV-002']);
  // 21 Jul + 14 days.
  assert.equal(exposures.find((e) => e.ref === 'EV-002').due, '2026-08-04');
});

test('cites the clause that was configured, and no clause when none was', () => {
  const events = {
    entries: [{ ref: 'EV-002', date: '2026-07-21', responsibility: 'employer', status: 'open', description: 'x' }],
  };

  const withClause = contractPosition({ contract: CONTRACT, programme: programme(null), events, asOf: ASOF });
  assert.match(withClause.exposures[0].detail, /Art\. 9\.2/);

  const without = contractPosition({
    contract: { ...CONTRACT, delayNoticeClause: null },
    programme: programme(null),
    events,
    asOf: ASOF,
  });
  assert.doesNotMatch(without.exposures[0].detail, /Art\./);
});

test('a served notice starts the particulars clock instead', () => {
  const events = {
    entries: [
      {
        ref: 'EV-002',
        date: '2026-07-01',
        responsibility: 'employer',
        status: 'open',
        description: 'x',
        noticeGiven: '2026-07-10',
      },
    ],
  };

  const { exposures } = contractPosition({ contract: CONTRACT, programme: programme(null), events, asOf: ASOF });
  const particulars = exposures.find((e) => e.kind === 'particulars');

  assert.ok(particulars, 'expected a particulars deadline once notice was served');
  assert.equal(particulars.due, '2026-08-07'); // 10 Jul + 28 days
  assert.equal(exposures.some((e) => e.kind === 'notice'), false, 'notice is served, so it is no longer running');
});

// --- late information ------------------------------------------------------

test('records the other side beyond its response period as evidence', () => {
  const rfi = {
    entries: [{ ref: 'RFI-001', date: '2026-07-16', status: 'open', subject: 'Steel tie detail', owner: 'Consultant' }],
  };

  const { exposures } = contractPosition({ contract: CONTRACT, programme: programme(null), rfi, asOf: ASOF });
  const late = exposures.find((e) => e.kind === 'late-information');

  assert.ok(late);
  assert.match(late.title, /7d beyond the contract period/);
  assert.match(late.detail, /evidence of late information/);
});

test('an RFI inside its period is not an exposure', () => {
  const rfi = { entries: [{ ref: 'RFI-002', date: '2026-07-28', status: 'open', subject: 'x', owner: 'Consultant' }] };
  const { exposures } = contractPosition({ contract: CONTRACT, programme: programme(null), rfi, asOf: ASOF });
  assert.equal(exposures.length, 0);
});

// --- honesty about what is not configured ----------------------------------

test('names every term that is not set, so silence is never mistaken for safety', () => {
  const { missing, watched } = contractPosition({ contract: {}, programme: programme(null), asOf: ASOF });
  assert.equal(missing.length, CONTRACT_TERMS.length);
  assert.equal(watched, false);

  const rendered = formatContract('X', contractPosition({ contract: {}, programme: programme(null), asOf: ASOF }));
  assert.match(rendered, /Not set, so not watched/);
  assert.match(rendered, /delay damages rate/);
});

test('a fully configured contract with nothing running says so plainly', () => {
  const position = contractPosition({
    contract: CONTRACT,
    programme: programme('2026-11-01'),
    asOf: ASOF,
  });
  assert.equal(position.exposures.length, 0);
  assert.match(formatContract('X', position), /Nothing in the contract is running against you today/);
});

test('the exposure wording never asserts that the money is owed', () => {
  const position = contractPosition({
    contract: CONTRACT,
    programme: programme('2026-12-02'),
    asOf: ASOF,
  });
  const damages = position.exposures.find((e) => e.kind === 'damages');
  assert.match(damages.detail, /if the overrun is not excused/);
  assert.doesNotMatch(damages.detail, /you owe|liable|payable/i);
});

// --- dates that reach a client-facing page ---------------------------------

test('a non-date in a hand-edited register prints verbatim, never as NaN', async () => {
  const { formatHuman } = await import('../src/util/dates.js');

  // Registers are hand-editable by design, so a value that is not a date can
  // always reach the renderer. It prints on a document that goes to a client:
  // a visibly wrong date invites a correction, "NaN undefined friday" invites a
  // phone call about whether the whole report can be trusted.
  assert.equal(formatHuman('friday'), 'friday');
  assert.equal(formatHuman('TBC'), 'TBC');
  assert.equal(formatHuman(''), '-');
  assert.equal(formatHuman(null), '-');
  assert.equal(formatHuman('2026-08-01'), '1 Aug 2026');
});
