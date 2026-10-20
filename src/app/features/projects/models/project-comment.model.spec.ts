import { commentSegments, toEditableText, toStoredBody } from './project-comment.model';

describe('Citazioni nei commenti', () => {
  it('trasforma "@Nome Cognome" nel formato salvato, solo per le persone scelte', () => {
    const chosen = new Map([
      ['Davide Canducci', 7],
      ['Elia Pasqualini', 3],
    ]);
    expect(toStoredBody('Ciao @Elia Pasqualini e @Davide Canducci, non @Mario', chosen)).toBe(
      'Ciao @[Elia Pasqualini](3) e @[Davide Canducci](7), non @Mario',
    );
  });

  it('divide il testo in parti e citazioni', () => {
    expect(commentSegments('Ciao @[Elia Pasqualini](3)!')).toEqual([
      { kind: 'text', text: 'Ciao ' },
      { kind: 'mention', name: 'Elia Pasqualini', resourceId: 3 },
      { kind: 'text', text: '!' },
    ]);
  });

  it('torna al testo modificabile ricordando le persone', () => {
    const editable = toEditableText('Per @[Elia Pasqualini](3): ok');
    expect(editable.text).toBe('Per @Elia Pasqualini: ok');
    expect(editable.chosen.get('Elia Pasqualini')).toBe(3);
  });
});
