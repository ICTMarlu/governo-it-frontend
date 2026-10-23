import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { CurrentUser } from '../../../core/models/current-user.model';
import { TicketSync } from '../models/ticket.model';
import { TicketSyncService } from './ticket-sync.service';

const status = (lastSuccessAt: string): TicketSync => ({
  configured: true,
  running: false,
  lastSuccessAt,
  lastRunAt: lastSuccessAt,
  lastSucceeded: true,
  lastMessage: 'Modifiche: 3 ticket',
  jiraBaseUrl: 'https://marlu-team.atlassian.net',
});

const user = (role: string): CurrentUser => ({
  id: 1,
  username: 'u',
  displayName: 'U',
  role,
  roleLabel: role,
  canViewCosts: false,
  resourceId: null,
  // Chi aggiorna i ticket da Jira ha "Modifica" su Ticket AMS: qui Admin e PM
  permissions: { TICKETS: role === 'ADMIN' || role === 'PM' ? 'EDIT' : 'VIEW' },
});

describe('TicketSyncService', () => {
  let service: TicketSyncService;
  let http: HttpTestingController;

  function setup(role: string): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const auth = TestBed.inject(AuthService);
    (auth as unknown as { currentUserState: { set(u: CurrentUser): void } }).currentUserState.set(
      user(role),
    );
    service = TestBed.inject(TicketSyncService);
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => http.verify());

  it('Admin: "Aggiorna" chiede a Jira e fa ricaricare tutte le pagine', () => {
    setup('ADMIN');
    service.known(status('2026-10-21T13:00:00Z'));

    service.refresh();
    expect(service.syncing()).toBe(true);
    const request = http.expectOne((r) => r.url === '/api/v1/tickets/sync' && r.method === 'POST');
    request.flush(status('2026-10-21T14:00:00Z'));

    expect(service.syncing()).toBe(false);
    expect(service.version()).toBe(1);
    expect(service.status()?.lastSuccessAt).toBe('2026-10-21T14:00:00Z');
    expect(service.sinceText()).toBeTruthy();
  });

  it('il controllo periodico ricarica le pagine solo se Jira è stato aggiornato', () => {
    setup('VIEWER');
    service.known(status('2026-10-21T13:00:00Z'));

    service.watch();
    http.expectOne((r) => r.method === 'GET').flush(status('2026-10-21T13:00:00Z'));
    expect(service.version()).toBe(0);
    service.unwatch();

    service.watch();
    http.expectOne((r) => r.method === 'GET').flush(status('2026-10-21T13:15:00Z'));
    expect(service.version()).toBe(1);
    service.unwatch();
  });

  it('chi non può aggiornare Jira ricarica solo i dati già copiati', () => {
    setup('VIEWER');
    expect(service.canSync()).toBe(false);
    service.refresh();
    expect(service.version()).toBe(1);
    http.expectNone((r) => r.method === 'POST');
  });
});
