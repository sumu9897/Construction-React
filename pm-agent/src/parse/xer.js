/**
 * Primavera P6 XER tokenizer.
 *
 * An XER file is tab-delimited with a tiny record grammar:
 *   ERMHDR<TAB>version<TAB>date<TAB>...     file header, once, first line
 *   %T<TAB>TABLE_NAME                       start of a table
 *   %F<TAB>field1<TAB>field2<TAB>...        field names for that table
 *   %R<TAB>value1<TAB>value2<TAB>...        one row
 *   %E                                      end of file
 *
 * P6 writes XER as Windows-1252, not UTF-8. Reading it as UTF-8 corrupts any
 * accented character in an activity name, so decode explicitly.
 */

import { readFile } from 'node:fs/promises';

const RECORD_HEADER = '%T';
const RECORD_FIELDS = '%F';
const RECORD_ROW = '%R';
const RECORD_END = '%E';

/**
 * Decode an XER buffer. P6 emits Windows-1252; some third-party tools emit
 * UTF-8. Sniff for a UTF-8 BOM and otherwise assume the P6 default.
 */
export function decodeXer(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer.subarray(3));
  }
  return new TextDecoder('windows-1252').decode(buffer);
}

/**
 * Parse XER text into { header, tables }, where tables is
 * { TABLE_NAME: { fields: string[], rows: Array<Record<string,string>> } }.
 *
 * Values are left as raw strings here. Typing and unit conversion happen in
 * normalize.js, so this stays a faithful representation of the file.
 */
export function parseXerText(text) {
  const tables = Object.create(null);
  let header = null;
  let current = null;

  // XER files from Windows use CRLF; split on either.
  const lines = text.split(/\r\n|\n|\r/);

  for (const line of lines) {
    if (line === '') continue;

    if (line.startsWith('ERMHDR')) {
      const parts = line.split('\t');
      header = {
        version: parts[1] ?? null,
        exportDate: parts[2] ?? null,
        projectName: parts[3] ?? null,
        user: parts[4] ?? null,
        userFullName: parts[5] ?? null,
        database: parts[6] ?? null,
        module: parts[7] ?? null,
        currency: parts[8] ?? null,
      };
      continue;
    }

    const tab = line.indexOf('\t');
    const tag = tab === -1 ? line : line.slice(0, tab);

    switch (tag) {
      case RECORD_HEADER: {
        const name = line.slice(tab + 1).trim();
        current = { fields: [], rows: [] };
        tables[name] = current;
        break;
      }
      case RECORD_FIELDS: {
        if (!current) break;
        current.fields = line.slice(tab + 1).split('\t');
        break;
      }
      case RECORD_ROW: {
        if (!current || current.fields.length === 0) break;
        const values = line.slice(tab + 1).split('\t');
        const row = Object.create(null);
        for (let i = 0; i < current.fields.length; i++) {
          // Trailing empty columns are frequently omitted by P6.
          row[current.fields[i]] = values[i] ?? '';
        }
        current.rows.push(row);
        break;
      }
      case RECORD_END:
        current = null;
        break;
      default:
        // Unknown record type - ignore rather than throw. XER gains new record
        // types between P6 versions and an unknown one is never fatal.
        break;
    }
  }

  if (!header) {
    throw new Error('Not an XER file: no ERMHDR record found');
  }

  return { header, tables };
}

export async function parseXerFile(path) {
  const buffer = await readFile(path);
  return parseXerText(decodeXer(buffer));
}
