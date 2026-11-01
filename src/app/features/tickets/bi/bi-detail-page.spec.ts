import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';

import { BiTicket } from './bi.model';
import { BiDetailPage } from './bi-detail-page';
import { BiStore } from './bi-store.service';
import { flashWindows, serviceFlash } from './service-flash.model';

const NOW = new Date(2026, 9, 30, 15);

function at(day: number, hour: number): string {
  return new Date(2026, 9, day, hour, 30).toISOString();
}

function ticket(changes: Partial<BiTicket>): BiTicket {
  return {
    key: 'MRLIT-1',
    summary: 'Ticket',
    status: 'Chiuso',
    category: 'DONE',
    pending: false,
    waitingCustomer: false,
    area: 'ERP',
    requestType: null,
    priority: 'Medium',
    assignee: 'Anna',
    resourceId: 1,
    reporter: 'Marco',
    projectCode: null,
    created: at(29, 9),
    resolved: at(30, 11),
    updated: at(30, 11),
    due: null,
    impact: null,
    statusChanged: null,
    lastMovement: at(30, 11),
    ...changes,
  };
}

function render(inputs: Record<string, string>, tickets: BiTicket[]): number {
  const store = {
    tickets: signal(tickets),
    scoped: signal(tickets),
    createdInPeriod: signal(tickets),
    data: signal({ sync: { jiraBaseUrl: null } }),
    error: signal(null),
    load: () => undefined,
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: BiStore, useValue: store }] });
  const fixture = TestBed.createComponent(BiDetailPage);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  return fixture.nativeElement.querySelectorAll('tbody tr').length;
}

describe('BiDetailPage — scope flash', () => {
  const tickets = [
    ticket({ key: 'MRLIT-1' }),
    ticket({ key: 'MRLIT-2', assignee: 'Bruno', reporter: 'Lucia', area: 'BI' }),
    ticket({ key: 'MRLIT-3', created: at(30, 9), resolved: null, category: 'NEW', assignee: null }),
  ];
  const { start, end } = flashWindows('today', NOW).current;
  const window = { scope: 'flash', from: String(start), to: String(end) };

  it('i numeri del flash e l’elenco tornano: chiusi, entrati, entrambi', () => {
    const flash = serviceFlash(tickets, flashWindows('today', NOW).current, NOW);
    expect(render({ ...window, kind: 'resolved' }, tickets)).toBe(flash.resolved);
    expect(render({ ...window, kind: 'created' }, tickets)).toBe(flash.created);
    expect(render({ ...window, kind: 'both' }, tickets)).toBe(3);
  });

  it('i filtri della barra restringono l’elenco', () => {
    expect(render({ ...window, kind: 'resolved', assignee: 'Bruno' }, tickets)).toBe(1);
    expect(render({ ...window, kind: 'resolved', reporter: 'Lucia' }, tickets)).toBe(1);
    expect(render({ ...window, kind: 'resolved', area: 'ERP' }, tickets)).toBe(1);
    expect(render({ ...window, kind: 'resolved', hour: '11' }, tickets)).toBe(2);
  });
});

describe('BiDetailPage — ticket fermi della Home', () => {
  it('mostra solo i ticket con le chiavi contate dalla Home', () => {
    const tickets = [
      ticket({ key: 'MRLIT-1', category: 'NEW', resolved: null }),
      ticket({ key: 'MRLIT-2', category: 'NEW', resolved: null }),
      ticket({ key: 'MRLIT-3', category: 'NEW', resolved: null }),
    ];
    expect(render({ scope: 'stalled', keys: 'MRLIT-1,MRLIT-3' }, tickets)).toBe(2);
    expect(render({ scope: 'stalled', keys: '' }, tickets)).toBe(0);
  });
});

describe('BiDetailPage — dal router', () => {
  it('legge i parametri dell’indirizzo e mostra i ticket del flash', async () => {
    const tickets = [ticket({ key: 'MRLIT-1' }), ticket({ key: 'MRLIT-2', assignee: 'Bruno' })];
    const store = {
      tickets: signal(tickets),
      scoped: signal(tickets),
      createdInPeriod: signal(tickets),
      data: signal({ sync: { jiraBaseUrl: null } }),
      error: signal(null),
      load: () => undefined,
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: BiStore, useValue: store },
        provideRouter(
          [{ path: 'dettaglio', component: BiDetailPage }],
          withComponentInputBinding(),
        ),
      ],
    });
    const { start, end } = flashWindows('today', NOW).current;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      `/dettaglio?scope=flash&kind=resolved&from=${start}&to=${end}&assignee=Bruno`,
    );
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelectorAll('tbody tr').length).toBe(1);
  });
});
