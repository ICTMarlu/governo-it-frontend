import {
  APPLICATION_COLUMNS,
  CONNECTION_COLUMNS,
  detectKind,
  parseCsv,
  toCsv,
  toImportRows,
} from './architecture-csv';

describe('architettura IT: file CSV (D-38)', () => {
  it('esporta con punto e virgola, virgolette dove servono e Sì/No', () => {
    const text = toCsv(CONNECTION_COLUMNS, [
      {
        sourceName: 'ERP',
        directionLabel: 'invia a',
        targetName: 'WMS',
        dataObjects: 'ordini; articoli',
        protocolLabel: 'SFTP / FTP (file)',
        frequencyLabel: 'Ogni ora',
        businessCriticalityLabel: 'Alta',
        details: 'cartella "out"',
        active: true,
      },
    ]);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe(
      'Da;Direzione;A;Dati scambiati;Protocollo;Frequenza;Criticità;Dettagli;Attiva',
    );
    expect(lines[1]).toBe(
      'ERP;invia a;WMS;"ordini; articoli";SFTP / FTP (file);Ogni ora;Alta;"cartella ""out""";Sì',
    );
  });

  it('rilegge quello che esporta, anche con a capo nelle celle', () => {
    const text = toCsv(APPLICATION_COLUMNS, [
      {
        name: 'ERP',
        typeLabel: 'Gestionale',
        notes: 'riga 1\nriga 2',
        userAreaNames: ['HR', 'IT'],
      },
    ]);
    const rows = parseCsv(text);
    expect(rows.length).toBe(2);
    expect(detectKind(rows[0])).toBe('applications');
    const [row] = toImportRows('applications', rows);
    expect(row['row']).toBe(2);
    expect(row['name']).toBe('ERP');
    expect(row['notes']).toBe('riga 1\nriga 2');
    expect(row['userAreas']).toBe('HR, IT');
    expect(row['active']).toBe('Sì');
  });

  it('riconosce il file connessioni anche salvato con la virgola e intestazioni in minuscolo', () => {
    const rows = parseCsv('da,direzione,a\nERP,invia a,WMS\n\n');
    expect(detectKind(rows[0])).toBe('connections');
    expect(toImportRows('connections', rows)).toEqual([
      { row: 2, source: 'ERP', direction: 'invia a', target: 'WMS' },
    ]);
  });

  it('un file senza intestazioni note non viene preso', () => {
    expect(detectKind(['Colonna1', 'Colonna2'])).toBeNull();
  });
});
