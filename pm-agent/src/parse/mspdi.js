/**
 * Microsoft Project XML (MSPDI) parser.
 *
 * Reads the XML that MS Project writes from File → Save As → XML, and produces
 * the same normalized programme object as the XER path, so everything
 * downstream is parser-agnostic. Never feed this a .mpp - that is the
 * undocumented binary format and this file makes no attempt at it.
 *
 * The unit conversions are where MSPDI bites, so they are spelled out:
 *   - durations are xsd:duration strings ("PT200H0M0S")
 *   - slack, lag and variances are integers in TENTHS OF MINUTES
 *   - costs are in hundredths of the currency unit
 *   - a day is MinutesPerDay long, not 24 hours
 * Getting any of these wrong produces float that is off by a factor of 600,
 * which is exactly the kind of quiet corruption the four-number check against
 * the scheduler's screen exists to catch.
 */

import { readFile } from 'node:fs/promises';
import { dayOf } from '../util/dates.js';
import { assembleProgramme } from './normalize.js';

const DEFAULT_MINUTES_PER_DAY = 480;

/** PredecessorLink Type field. MS Project's enumeration, not P6's. */
const LINK_TYPES = { 0: 'FF', 1: 'FS', 2: 'SF', 3: 'SS' };

/**
 * ConstraintType 0 is "As Soon As Possible" - the default, not a constraint at
 * all - so it is deliberately absent and maps to null.
 */
const CONSTRAINTS = {
  1: { label: 'As Late As Possible', hard: false },
  2: { label: 'Must Start On', hard: true },
  3: { label: 'Must Finish On', hard: true },
  4: { label: 'Start No Earlier Than', hard: false },
  5: { label: 'Start No Later Than', hard: false },
  6: { label: 'Finish No Earlier Than', hard: false },
  7: { label: 'Finish No Later Than', hard: false },
};

// --- Minimal XML reader ------------------------------------------------------
//
// MSPDI is machine-written, namespace-free in practice, and attribute-free on
// every element we read, which is what makes a dependency-free reader honest
// rather than heroic. This is not a general XML parser and must not grow into
// one.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text) {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body] ?? whole;
  });
}

/**
 * Parse XML text into {name, children, text} nodes. Attributes are discarded;
 * MSPDI carries everything as element text.
 */
export function parseXml(text) {
  const root = { name: null, children: [], text: '' };
  const stack = [root];
  const tag = /<(!\[CDATA\[[\s\S]*?\]\]|!--[\s\S]*?--|[^>]+)>/g;

  let last = 0;
  let match;
  while ((match = tag.exec(text)) !== null) {
    const current = stack[stack.length - 1];
    const between = text.slice(last, match.index);
    if (between.trim() !== '') current.text += decodeEntities(between.trim());
    last = tag.lastIndex;

    const body = match[1];
    if (body.startsWith('!--') || body.startsWith('?') || body.startsWith('!DOCTYPE')) continue;
    if (body.startsWith('![CDATA[')) {
      current.text += body.slice(8, -2);
      continue;
    }

    if (body.startsWith('/')) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    const selfClosing = body.endsWith('/');
    const name = body.replace(/\/$/, '').split(/[\s]/, 1)[0];
    const node = { name, children: [], text: '' };
    current.children.push(node);
    if (!selfClosing) stack.push(node);
  }

  return root;
}

const child = (node, name) => node?.children.find((c) => c.name === name);
const children = (node, name) => node?.children.filter((c) => c.name === name) ?? [];
const text = (node, name) => {
  const c = child(node, name);
  return c && c.text !== '' ? c.text : null;
};

const num = (node, name) => {
  const value = text(node, name);
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const flag = (node, name) => text(node, name) === '1';

// --- Unit conversions --------------------------------------------------------

/** "PT200H30M0S" → 200.5 hours. MSPDI never writes days into these. */
export function parseXsdDuration(value) {
  if (!value) return null;
  const match = /^-?PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value.trim());
  if (!match) return null;
  const [, h = '0', m = '0', s = '0'] = match;
  const hours = Number(h) + Number(m) / 60 + Number(s) / 3600;
  return value.trim().startsWith('-') ? -hours : hours;
}

/** MSPDI ISO datetime → the same "YYYY-MM-DDTHH:mm:00" shape parseP6Date emits. */
function parseDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(value).trim());
  if (!match) return null;
  const [, y, m, d, hh = '00', mm = '00'] = match;
  return `${y}-${m}-${d}T${hh}:${mm}:00`;
}

const round1 = (n) => Math.round(n * 10) / 10;

// --- The parser --------------------------------------------------------------

export function decodeMspdi(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer.subarray(3));
  }
  return new TextDecoder('utf-8').decode(buffer);
}

/**
 * @param {string} xmlText
 * @param {{projectCode?: string, sourceFile?: string}} [options]
 */
export function parseMspdiText(xmlText, options = {}) {
  const doc = parseXml(xmlText);
  const project = child(doc, 'Project');
  if (!project) throw new Error('Not an MS Project XML file: no <Project> element');

  const minutesPerDay = num(project, 'MinutesPerDay') ?? DEFAULT_MINUTES_PER_DAY;
  const hoursPerDay = minutesPerDay / 60;
  const toDays = (hours) => (hours === null ? null : round1(hours / hoursPerDay));
  /** Slack and lag arrive in tenths of minutes. */
  const tenthsToDays = (tenths) => (tenths === null ? null : round1(tenths / 600 / hoursPerDay));

  const calendars = new Map(
    children(child(project, 'Calendars'), 'Calendar').map((cal) => [
      text(cal, 'UID'),
      { id: text(cal, 'UID'), name: text(cal, 'Name'), hoursPerDay },
    ]),
  );

  // MSPDI has no separate WBS table - the outline IS the WBS. Summary tasks
  // become WBS nodes; leaf tasks hang off the nearest enclosing summary. Tasks
  // appear in outline order, so a stack per outline level resolves parentage.
  const wbs = [];
  const activities = [];
  const summaryStack = [];

  for (const task of children(child(project, 'Tasks'), 'Task')) {
    if (flag(task, 'IsNull')) continue;
    const uid = text(task, 'UID');
    if (uid === '0') continue; // the project summary row, not an activity
    const active = text(task, 'Active');
    if (active === '0') continue; // inactive tasks are not in the programme

    const outlineLevel = num(task, 'OutlineLevel') ?? 1;
    while (summaryStack.length && summaryStack[summaryStack.length - 1].level >= outlineLevel) {
      summaryStack.pop();
    }
    const parent = summaryStack[summaryStack.length - 1] ?? null;

    if (flag(task, 'Summary')) {
      const node = {
        id: uid,
        code: text(task, 'WBS') ?? text(task, 'OutlineNumber'),
        name: text(task, 'Name'),
        parentId: parent?.id ?? null,
        isProjectNode: false,
        path: [...(parent ? [parent.path] : []), text(task, 'Name') ?? uid].join(' / '),
      };
      wbs.push(node);
      summaryStack.push({ id: uid, level: outlineLevel, path: node.path });
      continue;
    }

    const durationHours = parseXsdDuration(text(task, 'Duration'));
    const remainingHours = parseXsdDuration(text(task, 'RemainingDuration'));
    const totalFloatDays = tenthsToDays(num(task, 'TotalSlack'));

    const actualStart = parseDate(text(task, 'ActualStart'));
    const actualFinish = parseDate(text(task, 'ActualFinish'));
    const durationPercent = num(task, 'PercentComplete') ?? 0;
    const physicalPercent = num(task, 'PhysicalPercentComplete') ?? 0;

    // MSP's headline number is duration-based PercentComplete. Prefer physical
    // when someone has actually tracked it, for the same reason the XER path
    // respects complete_pct_type: it is the one a QS will defend.
    const percent = physicalPercent > 0
      ? { value: physicalPercent, basis: 'physical' }
      : { value: durationPercent, basis: 'duration' };

    const status = actualFinish || durationPercent >= 100
      ? 'complete'
      : actualStart || durationPercent > 0
        ? 'in-progress'
        : 'not-started';

    const constraint = CONSTRAINTS[num(task, 'ConstraintType')];
    const cost = num(task, 'Cost');
    const actualCost = num(task, 'ActualCost');
    const remainingCost = num(task, 'RemainingCost');

    const activity = {
      id: uid,
      code: text(task, 'WBS') ?? text(task, 'OutlineNumber') ?? uid,
      name: text(task, 'Name'),
      wbsId: parent?.id ?? null,
      wbsPath: parent?.path ?? null,
      type: flag(task, 'Milestone') ? 'finish-milestone' : 'task',
      status,

      planStart: parseDate(text(task, 'Start')),
      planFinish: parseDate(text(task, 'Finish')),
      earlyStart: parseDate(text(task, 'EarlyStart')),
      earlyFinish: parseDate(text(task, 'EarlyFinish')),
      lateStart: parseDate(text(task, 'LateStart')),
      lateFinish: parseDate(text(task, 'LateFinish')),
      actualStart,
      actualFinish,

      durationDays: toDays(durationHours),
      remainingDays: toDays(remainingHours),
      percentComplete: percent.value,
      percentBasis: percent.basis,

      totalFloatDays,
      freeFloatDays: tenthsToDays(num(task, 'FreeSlack')),
      critical: flag(task, 'Critical') || (totalFloatDays !== null && totalFloatDays <= 0),
      // MSP has no longest-path flag; Critical is the nearest it offers.
      longestPath: flag(task, 'Critical'),

      constraintType: constraint?.label ?? null,
      constraintIsHard: constraint?.hard ?? false,
      constraintDate: parseDate(text(task, 'ConstraintDate')),
      secondaryConstraintType: null,
      secondaryConstraintDate: null,

      calendarId: text(task, 'CalendarUID'),
      calendarHoursPerDay: hoursPerDay,
    };

    if (cost !== null) activity.budgetCost = round1(cost / 100);
    if (actualCost !== null) activity.actualCost = round1(actualCost / 100);
    if (remainingCost !== null) activity.remainingCost = round1(remainingCost / 100);

    activity.links = children(task, 'PredecessorLink');
    activities.push(activity);
  }

  // Links live inside each successor task, pointing back at the predecessor.
  const activityIds = new Set(activities.map((a) => a.id));
  const relationships = [];
  for (const activity of activities) {
    for (const link of activity.links) {
      if (flag(link, 'CrossProject')) continue;
      const predecessorId = text(link, 'PredecessorUID');
      if (!activityIds.has(predecessorId)) continue;
      const lagFormat = num(link, 'LagFormat');
      // LagFormat 19/20 is percent lag - no fixed day value exists, so record
      // zero rather than a wrong number. Vanishingly rare on site programmes.
      const isPercent = lagFormat === 19 || lagFormat === 20;
      relationships.push({
        id: `${predecessorId}-${activity.id}`,
        predecessorId,
        successorId: activity.id,
        type: LINK_TYPES[num(link, 'Type')] ?? 'FS',
        lagDays: isPercent ? 0 : tenthsToDays(num(link, 'LinkLag')) ?? 0,
      });
    }
    delete activity.links;
  }

  const dataDate = parseDate(
    text(project, 'StatusDate') ?? text(project, 'CurrentDate') ?? text(project, 'LastSaved'),
  );

  return assembleProgramme({
    source: {
      file: options.sourceFile ?? null,
      p6Version: null,
      application: `Microsoft Project (save version ${text(project, 'SaveVersion') ?? '?'})`,
      exportedAt: parseDate(text(project, 'LastSaved') ?? text(project, 'CreationDate')),
      exportedBy: text(project, 'Author'),
      currency: text(project, 'CurrencyCode'),
    },
    project: {
      id: text(project, 'UID') ?? '1',
      code: options.projectCode ?? text(project, 'Name') ?? text(project, 'Title'),
      name: text(project, 'Title') ?? text(project, 'Name'),
      dataDate,
      dataDateDay: dayOf(dataDate),
      plannedStart: parseDate(text(project, 'StartDate')),
      plannedFinish: parseDate(text(project, 'FinishDate')),
      mustFinishBy: null,
    },
    calendars: Object.fromEntries(calendars),
    wbs,
    activities,
    relationships,
  });
}

export async function parseMspdiFile(filePath, options = {}) {
  const buffer = await readFile(filePath);
  return parseMspdiText(decodeMspdi(buffer), options);
}
