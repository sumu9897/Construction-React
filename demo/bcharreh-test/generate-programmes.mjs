/**
 * Generates the two MS Project XML files for the BCHARREH-TEST practice
 * scenario: the approved baseline, and a current update with the project
 * mid-flight on 28 Jul 2026. Run from the repo root:
 *
 *   node demo/bcharreh-test/generate-programmes.mjs
 *
 * Everything here is FICTIONAL TEST DATA for practising with the bot.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { makeMspdi } from "../../pm-agent/test/fixtures/make-mspdi.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The renovation of two heritage stone houses, as planned in February. */
const BASELINE = {
  projectCode: "BCHARREH-TEST",
  dataDate: "2026-03-02",
  planStart: "2026-03-02",
  planFinish: "2026-11-27",
  hoursPerDay: 8,
  activities: [
    { code: "EN-100", name: "Site establishment & scaffolding — House A", durationDays: 10, remainingDays: 10, planStart: "2026-03-02", planFinish: "2026-03-13", totalFloatDays: 0, critical: true },
    { code: "EN-110", name: "Scaffolding — House B", durationDays: 10, remainingDays: 10, planStart: "2026-03-16", planFinish: "2026-03-27", totalFloatDays: 8 },
    { code: "RF-200", name: "Roof strip & timber survey — House A", durationDays: 15, remainingDays: 15, planStart: "2026-03-16", planFinish: "2026-04-03", totalFloatDays: 0, critical: true },
    { code: "RF-210", name: "Roof re-tile — House A", durationDays: 20, remainingDays: 20, planStart: "2026-04-06", planFinish: "2026-05-01", totalFloatDays: 0, critical: true },
    { code: "RF-220", name: "Roof strip — House B", durationDays: 15, remainingDays: 15, planStart: "2026-04-06", planFinish: "2026-04-24", totalFloatDays: 5 },
    { code: "RF-230", name: "Roof re-tile — House B", durationDays: 20, remainingDays: 20, planStart: "2026-04-27", planFinish: "2026-05-22", totalFloatDays: 5 },
    { code: "ST-300", name: "Stone repairs & repointing — House A", durationDays: 50, remainingDays: 50, planStart: "2026-04-06", planFinish: "2026-06-12", totalFloatDays: 12 },
    { code: "ST-310", name: "Stone repairs & repointing — House B", durationDays: 40, remainingDays: 40, planStart: "2026-05-25", planFinish: "2026-07-17", totalFloatDays: 6 },
    { code: "SR-400", name: "Structural steel ties & new lintels — House A", durationDays: 20, remainingDays: 20, planStart: "2026-05-04", planFinish: "2026-05-29", totalFloatDays: 3 },
    { code: "JN-500", name: "Joinery restoration in workshop (windows & doors)", durationDays: 60, remainingDays: 60, planStart: "2026-04-13", planFinish: "2026-07-03", totalFloatDays: 2 },
    { code: "JN-510", name: "Joinery installation — House A", durationDays: 20, remainingDays: 20, planStart: "2026-07-06", planFinish: "2026-07-31", totalFloatDays: 2 },
    { code: "JN-520", name: "Joinery installation — House B", durationDays: 20, remainingDays: 20, planStart: "2026-08-03", planFinish: "2026-08-28", totalFloatDays: 4 },
    { code: "ME-600", name: "MEP first fix — House A", durationDays: 30, remainingDays: 30, planStart: "2026-06-01", planFinish: "2026-07-10", totalFloatDays: 9 },
    { code: "ME-610", name: "MEP first fix — House B", durationDays: 30, remainingDays: 30, planStart: "2026-07-20", planFinish: "2026-08-28", totalFloatDays: 4 },
    { code: "PL-700", name: "Lime plaster & render — House A", durationDays: 30, remainingDays: 30, planStart: "2026-07-13", planFinish: "2026-08-21", totalFloatDays: 0, critical: true },
    { code: "PL-710", name: "Lime plaster & render — House B", durationDays: 30, remainingDays: 30, planStart: "2026-08-31", planFinish: "2026-10-09", totalFloatDays: 0, critical: true },
    { code: "FN-800", name: "Internal finishes — House A", durationDays: 30, remainingDays: 30, planStart: "2026-08-24", planFinish: "2026-10-02", totalFloatDays: 3 },
    { code: "FN-810", name: "Internal finishes — House B", durationDays: 25, remainingDays: 25, planStart: "2026-10-12", planFinish: "2026-11-13", totalFloatDays: 0, critical: true },
    { code: "EX-900", name: "External works, terraces & drainage", durationDays: 40, remainingDays: 40, planStart: "2026-09-07", planFinish: "2026-10-30", totalFloatDays: 10 },
    { code: "PC-999", name: "Practical completion", type: "TT_FinMile", durationDays: 0, remainingDays: 0, planStart: "2026-11-27", planFinish: "2026-11-27", totalFloatDays: 0, critical: true },
  ],
  relationships: [
    { pred: "EN-100", succ: "RF-200" },
    { pred: "EN-110", succ: "RF-220" },
    { pred: "RF-200", succ: "RF-210" },
    { pred: "RF-220", succ: "RF-230" },
    { pred: "RF-210", succ: "ST-300", type: "SS", lagDays: 0 },
    { pred: "RF-230", succ: "ST-310", type: "SS", lagDays: 0 },
    { pred: "ST-300", succ: "SR-400", type: "SS", lagDays: 10 },
    { pred: "JN-500", succ: "JN-510" },
    { pred: "JN-510", succ: "JN-520" },
    { pred: "RF-210", succ: "ME-600" },
    { pred: "RF-230", succ: "ME-610" },
    { pred: "ME-600", succ: "PL-700" },
    { pred: "JN-510", succ: "PL-700" },
    { pred: "ME-610", succ: "PL-710" },
    { pred: "PL-700", succ: "FN-800" },
    { pred: "PL-710", succ: "FN-810" },
    { pred: "FN-810", succ: "PC-999" },
    { pred: "FN-800", succ: "PC-999" },
    { pred: "EX-900", succ: "PC-999" },
  ],
};

/**
 * The same programme five months in, updated 28 Jul 2026. Roofs done late,
 * House B stonework and the joinery workshop both running behind, House A
 * plaster overdue to start, three days of forecast slip on the B chain.
 */
const CURRENT = {
  ...BASELINE,
  dataDate: "2026-07-28",
  activities: [
    { code: "EN-100", name: "Site establishment & scaffolding — House A", status: "TK_Complete", durationDays: 10, remainingDays: 0, percentComplete: 100, planStart: "2026-03-02", planFinish: "2026-03-13", actualStart: "2026-03-02", actualFinish: "2026-03-13", totalFloatDays: 0, critical: true },
    { code: "EN-110", name: "Scaffolding — House B", status: "TK_Complete", durationDays: 10, remainingDays: 0, percentComplete: 100, planStart: "2026-03-16", planFinish: "2026-03-27", actualStart: "2026-03-16", actualFinish: "2026-03-31", totalFloatDays: 6 },
    { code: "RF-200", name: "Roof strip & timber survey — House A", status: "TK_Complete", durationDays: 15, remainingDays: 0, percentComplete: 100, planStart: "2026-03-16", planFinish: "2026-04-03", actualStart: "2026-03-16", actualFinish: "2026-04-08", totalFloatDays: 0, critical: true },
    { code: "RF-210", name: "Roof re-tile — House A", status: "TK_Complete", durationDays: 20, remainingDays: 0, percentComplete: 100, planStart: "2026-04-06", planFinish: "2026-05-01", actualStart: "2026-04-09", actualFinish: "2026-05-08", totalFloatDays: 0, critical: true },
    { code: "RF-220", name: "Roof strip — House B", status: "TK_Complete", durationDays: 15, remainingDays: 0, percentComplete: 100, planStart: "2026-04-06", planFinish: "2026-04-24", actualStart: "2026-04-10", actualFinish: "2026-05-01", totalFloatDays: 5 },
    { code: "RF-230", name: "Roof re-tile — House B", status: "TK_Complete", durationDays: 20, remainingDays: 0, percentComplete: 100, planStart: "2026-04-27", planFinish: "2026-05-22", actualStart: "2026-05-04", actualFinish: "2026-06-05", totalFloatDays: 5 },
    { code: "ST-300", name: "Stone repairs & repointing — House A", status: "TK_Complete", durationDays: 50, remainingDays: 0, percentComplete: 100, planStart: "2026-04-06", planFinish: "2026-06-12", actualStart: "2026-04-13", actualFinish: "2026-06-26", totalFloatDays: 8 },
    { code: "ST-310", name: "Stone repairs & repointing — House B", status: "TK_Active", durationDays: 40, remainingDays: 10, percentComplete: 65, planStart: "2026-05-25", planFinish: "2026-07-17", actualStart: "2026-06-08", totalFloatDays: -3 },
    { code: "SR-400", name: "Structural steel ties & new lintels — House A", status: "TK_Complete", durationDays: 20, remainingDays: 0, percentComplete: 100, planStart: "2026-05-04", planFinish: "2026-05-29", actualStart: "2026-05-11", actualFinish: "2026-06-05", totalFloatDays: 3 },
    { code: "JN-500", name: "Joinery restoration in workshop (windows & doors)", status: "TK_Active", durationDays: 60, remainingDays: 8, percentComplete: 80, planStart: "2026-04-13", planFinish: "2026-07-03", actualStart: "2026-04-13", totalFloatDays: 1 },
    { code: "JN-510", name: "Joinery installation — House A", durationDays: 20, remainingDays: 20, percentComplete: 0, planStart: "2026-07-06", planFinish: "2026-07-31", totalFloatDays: 1 },
    { code: "JN-520", name: "Joinery installation — House B", durationDays: 20, remainingDays: 20, percentComplete: 0, planStart: "2026-08-10", planFinish: "2026-09-04", totalFloatDays: 3 },
    { code: "ME-600", name: "MEP first fix — House A", status: "TK_Active", durationDays: 30, remainingDays: 9, percentComplete: 70, planStart: "2026-06-08", planFinish: "2026-07-10", actualStart: "2026-06-08", totalFloatDays: 6 },
    { code: "ME-610", name: "MEP first fix — House B", durationDays: 30, remainingDays: 30, percentComplete: 0, planStart: "2026-08-03", planFinish: "2026-09-11", totalFloatDays: -3 },
    { code: "PL-700", name: "Lime plaster & render — House A", durationDays: 30, remainingDays: 30, percentComplete: 0, planStart: "2026-07-13", planFinish: "2026-08-21", totalFloatDays: 0, critical: true },
    { code: "PL-710", name: "Lime plaster & render — House B", durationDays: 30, remainingDays: 30, percentComplete: 0, planStart: "2026-09-14", planFinish: "2026-10-23", totalFloatDays: -3, critical: true },
    { code: "FN-800", name: "Internal finishes — House A", durationDays: 30, remainingDays: 30, percentComplete: 0, planStart: "2026-08-24", planFinish: "2026-10-02", totalFloatDays: 3 },
    { code: "FN-810", name: "Internal finishes — House B", durationDays: 25, remainingDays: 25, percentComplete: 0, planStart: "2026-10-26", planFinish: "2026-11-27", totalFloatDays: -3, critical: true },
    { code: "EX-900", name: "External works, terraces & drainage", durationDays: 40, remainingDays: 40, percentComplete: 0, planStart: "2026-09-07", planFinish: "2026-10-30", totalFloatDays: 8 },
    { code: "PC-999", name: "Practical completion", type: "TT_FinMile", durationDays: 0, remainingDays: 0, percentComplete: 0, planStart: "2026-12-02", planFinish: "2026-12-02", totalFloatDays: -3, critical: true },
  ],
};


/**
 * The previous monthly update, 30 Jun 2026 — before the B-chain slipped
 * negative: joinery workshop already late, House B stonework tight but
 * holding, completion still on 27 Nov.
 */
const PREVIOUS = {
  ...BASELINE,
  dataDate: "2026-06-30",
  activities: [
    { code: "EN-100", name: "Site establishment & scaffolding — House A", status: "TK_Complete", durationDays: 10, remainingDays: 0, percentComplete: 100, planStart: "2026-03-02", planFinish: "2026-03-13", actualStart: "2026-03-02", actualFinish: "2026-03-13", totalFloatDays: 0, critical: true },
    { code: "EN-110", name: "Scaffolding — House B", status: "TK_Complete", durationDays: 10, remainingDays: 0, percentComplete: 100, planStart: "2026-03-16", planFinish: "2026-03-27", actualStart: "2026-03-16", actualFinish: "2026-03-31", totalFloatDays: 6 },
    { code: "RF-200", name: "Roof strip & timber survey — House A", status: "TK_Complete", durationDays: 15, remainingDays: 0, percentComplete: 100, planStart: "2026-03-16", planFinish: "2026-04-03", actualStart: "2026-03-16", actualFinish: "2026-04-08", totalFloatDays: 0, critical: true },
    { code: "RF-210", name: "Roof re-tile — House A", status: "TK_Complete", durationDays: 20, remainingDays: 0, percentComplete: 100, planStart: "2026-04-06", planFinish: "2026-05-01", actualStart: "2026-04-09", actualFinish: "2026-05-08", totalFloatDays: 0, critical: true },
    { code: "RF-220", name: "Roof strip — House B", status: "TK_Complete", durationDays: 15, remainingDays: 0, percentComplete: 100, planStart: "2026-04-06", planFinish: "2026-04-24", actualStart: "2026-04-10", actualFinish: "2026-05-01", totalFloatDays: 5 },
    { code: "RF-230", name: "Roof re-tile — House B", status: "TK_Complete", durationDays: 20, remainingDays: 0, percentComplete: 100, planStart: "2026-04-27", planFinish: "2026-05-22", actualStart: "2026-05-04", actualFinish: "2026-06-05", totalFloatDays: 5 },
    { code: "ST-300", name: "Stone repairs & repointing — House A", status: "TK_Complete", durationDays: 50, remainingDays: 0, percentComplete: 100, planStart: "2026-04-06", planFinish: "2026-06-12", actualStart: "2026-04-13", actualFinish: "2026-06-26", totalFloatDays: 8 },
    { code: "ST-310", name: "Stone repairs & repointing — House B", status: "TK_Active", durationDays: 40, remainingDays: 20, percentComplete: 40, planStart: "2026-05-25", planFinish: "2026-07-17", actualStart: "2026-06-08", totalFloatDays: 0 },
    { code: "SR-400", name: "Structural steel ties & new lintels — House A", status: "TK_Complete", durationDays: 20, remainingDays: 0, percentComplete: 100, planStart: "2026-05-04", planFinish: "2026-05-29", actualStart: "2026-05-11", actualFinish: "2026-06-05", totalFloatDays: 3 },
    { code: "JN-500", name: "Joinery restoration in workshop (windows & doors)", status: "TK_Active", durationDays: 60, remainingDays: 15, percentComplete: 68, planStart: "2026-04-13", planFinish: "2026-07-03", actualStart: "2026-04-13", totalFloatDays: 2 },
    { code: "JN-510", name: "Joinery installation — House A", durationDays: 20, remainingDays: 20, percentComplete: 0, planStart: "2026-07-06", planFinish: "2026-07-31", totalFloatDays: 2 },
    { code: "JN-520", name: "Joinery installation — House B", durationDays: 20, remainingDays: 20, percentComplete: 0, planStart: "2026-08-03", planFinish: "2026-08-28", totalFloatDays: 4 },
    { code: "ME-600", name: "MEP first fix — House A", status: "TK_Active", durationDays: 30, remainingDays: 14, percentComplete: 50, planStart: "2026-06-08", planFinish: "2026-07-10", actualStart: "2026-06-08", totalFloatDays: 7 },
    { code: "ME-610", name: "MEP first fix — House B", durationDays: 30, remainingDays: 30, percentComplete: 0, planStart: "2026-07-27", planFinish: "2026-09-04", totalFloatDays: 0 },
    { code: "PL-700", name: "Lime plaster & render — House A", durationDays: 30, remainingDays: 30, percentComplete: 0, planStart: "2026-07-13", planFinish: "2026-08-21", totalFloatDays: 0, critical: true },
    { code: "PL-710", name: "Lime plaster & render — House B", durationDays: 30, remainingDays: 30, percentComplete: 0, planStart: "2026-09-07", planFinish: "2026-10-16", totalFloatDays: 0, critical: true },
    { code: "FN-800", name: "Internal finishes — House A", durationDays: 30, remainingDays: 30, percentComplete: 0, planStart: "2026-08-24", planFinish: "2026-10-02", totalFloatDays: 3 },
    { code: "FN-810", name: "Internal finishes — House B", durationDays: 25, remainingDays: 25, percentComplete: 0, planStart: "2026-10-19", planFinish: "2026-11-20", totalFloatDays: 0, critical: true },
    { code: "EX-900", name: "External works, terraces & drainage", durationDays: 40, remainingDays: 40, percentComplete: 0, planStart: "2026-09-07", planFinish: "2026-10-30", totalFloatDays: 9 },
    { code: "PC-999", name: "Practical completion", type: "TT_FinMile", durationDays: 0, remainingDays: 0, percentComplete: 0, planStart: "2026-11-27", planFinish: "2026-11-27", totalFloatDays: 0, critical: true },
  ],
};

writeFileSync(path.join(here, "programme-baseline.xml"), makeMspdi(BASELINE));
writeFileSync(path.join(here, "programme-previous.xml"), makeMspdi(PREVIOUS));
writeFileSync(path.join(here, "programme-current.xml"), makeMspdi(CURRENT));
console.log("wrote baseline, previous and current programmes");
