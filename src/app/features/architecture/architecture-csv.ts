import { EntityRow } from '../../shared/crud/crud.model';

/**
 * File CSV di Architettura IT (D-38): separatore punto e virgola e BOM, così Excel in italiano li
 * apre e li salva senza passaggi. Le intestazioni sono in italiano e fanno anche da modello.
 */

interface CsvColumn {
  readonly header: string;
  /** Chiave della riga di import inviata al backend. */
  readonly key: string;
  /** Valore esportato dalla riga dell'elenco. */
  readonly read: (row: EntityRow) => unknown;
  /** Altre intestazioni accettate in import (es. quella dei file di una versione precedente). */
  readonly aliases?: readonly string[];
}

const list = (key: string) => (row: EntityRow) =>
  Array.isArray(row[key]) ? (row[key] as unknown[]).join(', ') : '';
const yesNo = (row: EntityRow) => (row['active'] === false ? 'No' : 'Sì');

export const APPLICATION_COLUMNS: readonly CsvColumn[] = [
  { header: 'Nome', key: 'name', read: (r) => r['name'] },
  { header: 'Tipologia', key: 'type', read: (r) => r['typeLabel'], aliases: ['Tipo'] },
  { header: 'Stato', key: 'lifecycle', read: (r) => r['lifecycleLabel'] },
  { header: 'Dove gira', key: 'deployment', read: (r) => r['deploymentLabel'] },
  { header: 'Fornitore', key: 'vendor', read: (r) => r['vendorName'] },
  { header: 'Sede', key: 'site', read: (r) => r['siteName'] },
  { header: 'Server', key: 'hosts', read: (r) => r['hosts'] },
  { header: 'Chi lo usa', key: 'userAreas', read: list('userAreaNames') },
  { header: 'Gira su', key: 'technologies', read: list('technologyNames') },
  { header: 'Criticità', key: 'businessCriticality', read: (r) => r['businessCriticalityLabel'] },
  { header: 'Esposizione', key: 'exposure', read: (r) => r['exposureLabel'] },
  { header: 'Referente IT', key: 'itOwner', read: (r) => r['ownerName'] },
  { header: 'Referente business', key: 'businessOwner', read: (r) => r['businessOwner'] },
  { header: 'Note', key: 'notes', read: (r) => r['notes'] },
  { header: 'Attivo', key: 'active', read: yesNo },
];

export const CONNECTION_COLUMNS: readonly CsvColumn[] = [
  { header: 'Da', key: 'source', read: (r) => r['sourceName'] },
  { header: 'Direzione', key: 'direction', read: (r) => r['directionLabel'] },
  { header: 'A', key: 'target', read: (r) => r['targetName'] },
  { header: 'Dati scambiati', key: 'dataObjects', read: (r) => r['dataObjects'] },
  { header: 'Protocollo', key: 'protocol', read: (r) => r['protocolLabel'] },
  { header: 'Frequenza', key: 'frequency', read: (r) => r['frequencyLabel'] },
  { header: 'Criticità', key: 'businessCriticality', read: (r) => r['businessCriticalityLabel'] },
  { header: 'Dettagli', key: 'details', read: (r) => r['details'] },
  { header: 'Attiva', key: 'active', read: yesNo },
];

/** Segno iniziale che dice a Excel che il file è in UTF-8 (accenti corretti). */
const BOM = String.fromCharCode(0xfeff);

function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Testo CSV (con BOM) delle righe date. */
export function toCsv(columns: readonly CsvColumn[], rows: readonly EntityRow[]): string {
  const lines = [
    columns.map((column) => cell(column.header)).join(';'),
    ...rows.map((row) => columns.map((column) => cell(column.read(row))).join(';')),
  ];
  return BOM + lines.join('\r\n') + '\r\n';
}

/** Righe di un CSV: separatore ; , o tabulazione (dalla prima riga), virgolette come Excel. */
export function parseCsv(text: string): string[][] {
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const separator = [';', '\t', ','].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

function plain(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export type CsvKind = 'applications' | 'connections';

/** Che file è, dalle intestazioni: Applicativi (Nome, Tipo…) o Connessioni (Da, A…). */
export function detectKind(header: readonly string[]): CsvKind | null {
  const names = new Set(header.map(plain));
  if (names.has('da') && names.has('a')) {
    return 'connections';
  }
  return names.has('nome') ? 'applications' : null;
}

/**
 * Righe del file pronte per il backend: una per riga del foglio, con il numero di riga di Excel
 * (l'intestazione è la riga 1). Le colonne sconosciute si ignorano.
 */
export function toImportRows(kind: CsvKind, rows: readonly string[][]): Record<string, unknown>[] {
  const [header, ...data] = rows;
  if (!header) {
    return [];
  }
  const columns = kind === 'applications' ? APPLICATION_COLUMNS : CONNECTION_COLUMNS;
  const keys = header.map(
    (title) =>
      columns.find((column) =>
        [column.header, ...(column.aliases ?? [])].some((name) => plain(name) === plain(title)),
      )?.key ?? null,
  );
  return data.map((cells, index) => {
    const row: Record<string, unknown> = { row: index + 2 };
    keys.forEach((key, column) => {
      if (key) {
        row[key] = (cells[column] ?? '').trim();
      }
    });
    return row;
  });
}

/** Scarica il testo come file. */
export function download(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
