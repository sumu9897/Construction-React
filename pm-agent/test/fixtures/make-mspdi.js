/**
 * Build MS Project XML from the same friendly spec make-xer.js accepts, so a
 * test can run one scenario through both parsers and demand the same answers.
 */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const el = (name, value) =>
  value === null || value === undefined || value === '' ? '' : `<${name}>${esc(value)}</${name}>`;

const LINK_TYPE_CODES = { FF: 0, FS: 1, SF: 2, SS: 3 };

const STATUS_TO_PERCENT = { TK_Complete: 100, TK_Active: 0, TK_NotStart: 0 };

/**
 * @param {object} spec  the same shape makeXer takes: dataDate, activities
 *   (friendly units - days, YYYY-MM-DD dates), relationships [{pred,succ,type,lagDays}]
 */
export function makeMspdi(spec) {
  const {
    projectCode = 'TEST-01',
    dataDate = '2026-07-01',
    planStart = '2026-01-05',
    planFinish = '2026-12-18',
    hoursPerDay = 8,
    activities = [],
    relationships = [],
  } = spec;

  const minutesPerDay = hoursPerDay * 60;
  const codeToUid = new Map(activities.map((a, i) => [a.code, String(1000 + i)]));
  const linksBySucc = new Map();
  for (const r of relationships) {
    const succ = codeToUid.get(r.succ);
    if (!linksBySucc.has(succ)) linksBySucc.set(succ, []);
    linksBySucc.get(succ).push(r);
  }

  const dur = (days) =>
    days === undefined || days === null ? null : `PT${days * hoursPerDay}H0M0S`;
  const tenths = (days) =>
    days === undefined || days === null ? null : Math.round(days * hoursPerDay * 600);
  const dt = (day, time) => (day ? `${day}T${time}` : null);

  const tasks = activities.map((a, i) => {
    const uid = codeToUid.get(a.code);
    const isMilestone = a.type === 'TT_FinMile' || a.type === 'TT_Mile';
    const percent =
      a.percentComplete !== undefined
        ? Number(a.percentComplete)
        : STATUS_TO_PERCENT[a.status ?? 'TK_NotStart'] ?? 0;

    const links = (linksBySucc.get(uid) ?? [])
      .map(
        (r) => `
      <PredecessorLink>
        <PredecessorUID>${codeToUid.get(r.pred)}</PredecessorUID>
        <Type>${LINK_TYPE_CODES[r.type ?? 'FS']}</Type>
        <CrossProject>0</CrossProject>
        ${el('LinkLag', tenths(r.lagDays ?? 0))}
        <LagFormat>7</LagFormat>
      </PredecessorLink>`,
      )
      .join('');

    return `
    <Task>
      <UID>${uid}</UID>
      <ID>${i + 1}</ID>
      ${el('Name', a.name ?? `Activity ${i}`)}
      <IsNull>0</IsNull>
      ${el('WBS', a.code)}
      <OutlineLevel>1</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>${isMilestone ? 1 : 0}</Milestone>
      <Active>1</Active>
      ${el('Duration', dur(a.durationDays))}
      ${el('RemainingDuration', dur(a.remainingDays))}
      ${el('Start', dt(a.planStart, '08:00:00'))}
      ${el('Finish', dt(a.planFinish, '17:00:00'))}
      ${el('EarlyStart', dt(a.planStart, '08:00:00'))}
      ${el('EarlyFinish', dt(a.planFinish, '17:00:00'))}
      ${el('LateStart', dt(a.lateStart, '08:00:00'))}
      ${el('LateFinish', dt(a.lateFinish, '17:00:00'))}
      ${el('ActualStart', dt(a.actualStart, '08:00:00'))}
      ${el('ActualFinish', dt(a.actualFinish, '17:00:00'))}
      <PercentComplete>${percent}</PercentComplete>
      ${el('PhysicalPercentComplete', a.percentComplete)}
      ${el('TotalSlack', tenths(a.totalFloatDays))}
      ${el('FreeSlack', tenths(a.freeFloatDays))}
      <Critical>${a.critical ? 1 : 0}</Critical>
      ${a.constraint === 'CS_MANDFIN' ? '<ConstraintType>3</ConstraintType>' : '<ConstraintType>0</ConstraintType>'}
      ${el('ConstraintDate', dt(a.constraintDate, '08:00:00'))}
      <CalendarUID>1</CalendarUID>${links}
    </Task>`;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>14</SaveVersion>
  <Name>${esc(projectCode)}</Name>
  <Title>${esc(projectCode)}</Title>
  <Author>Test Harness</Author>
  <CurrencyCode>USD</CurrencyCode>
  <MinutesPerDay>${minutesPerDay}</MinutesPerDay>
  <StartDate>${planStart}T08:00:00</StartDate>
  <FinishDate>${planFinish}T17:00:00</FinishDate>
  <StatusDate>${dataDate}T00:00:00</StatusDate>
  <LastSaved>${dataDate}T09:00:00</LastSaved>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>6 Day Site Calendar</Name>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>${esc(projectCode)}</Name>
      <IsNull>0</IsNull>
      <OutlineLevel>0</OutlineLevel>
      <Summary>1</Summary>
    </Task>${tasks.join('')}
  </Tasks>
</Project>
`;
}
