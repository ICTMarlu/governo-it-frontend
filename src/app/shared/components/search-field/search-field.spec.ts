import { TestBed } from '@angular/core/testing';

import { SearchField } from './search-field';

describe('SearchField', () => {
  function setup(value = '') {
    const fixture = TestBed.createComponent(SearchField);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('placeholder', 'Cerca nei task');
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const input = host.querySelector('input') as HTMLInputElement;
    return { fixture, host, input, component: fixture.componentInstance };
  }

  it('ha lo stile comune e il testo d’esempio come nome accessibile', () => {
    const { host, input } = setup();
    expect(host.classList).toContain('inline-search');
    expect(input.placeholder).toBe('Cerca nei task');
    expect(input.getAttribute('aria-label')).toBe('Cerca nei task');
  });

  it('aggiorna il valore mentre si scrive e mostra la ✕ solo con del testo', () => {
    const { fixture, host, input, component } = setup();
    expect(host.querySelector('.inline-search__clear')).toBeNull();

    input.value = 'piano';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.value()).toBe('piano');
    expect(host.querySelector('.inline-search__clear')).not.toBeNull();
  });

  it('svuota con la ✕ e con Esc', () => {
    const { fixture, host, input, component } = setup('ticket');

    (host.querySelector('.inline-search__clear') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.value()).toBe('');

    component.value.set('ancora');
    fixture.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(component.value()).toBe('');
  });
});
