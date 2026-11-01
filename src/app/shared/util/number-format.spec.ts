import { formatNumber, numberFormat } from './number-format';

describe('number-format', () => {
  it('mette il punto delle migliaia anche sui numeri di 4 cifre', () => {
    expect(formatNumber(1372)).toBe('1.372');
    expect(formatNumber(16458)).toBe('16.458');
  });

  it('rispetta i decimali massimi', () => {
    expect(formatNumber(1372.456)).toBe('1.372,46');
    expect(formatNumber(7.25, 1)).toBe('7,3');
  });

  it('formatta gli euro con il separatore', () => {
    const euro = numberFormat({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    // fra numero e simbolo c'è uno spazio non separabile
    expect(euro.format(1372).replace(/\s/g, ' ')).toBe('1.372 €');
  });

  it('riusa lo stesso formattatore a parità di opzioni', () => {
    expect(numberFormat({ maximumFractionDigits: 1 })).toBe(
      numberFormat({ maximumFractionDigits: 1 }),
    );
  });
});
