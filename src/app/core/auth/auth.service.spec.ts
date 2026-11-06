import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CurrentUser } from '../models/current-user.model';
import { AuthService } from './auth.service';

const USER: CurrentUser = {
  id: 1,
  username: 'mario',
  displayName: 'Mario Rossi',
  role: 'EDITOR',
  roleLabel: 'Editor',
  canViewCosts: false,
  resourceId: null,
  permissions: {},
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('al login invia le credenziali in Basic e apre la sessione', () => {
    service.login('mario', 'pàss').subscribe();

    const request = http.expectOne('/api/v1/auth/me');
    const expected = `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode('mario:pàss')))}`;
    expect(request.request.headers.get('Authorization')).toBe(expected);
    request.flush(USER);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.displayName).toBe('Mario Rossi');
    expect(service.authorizationHeader()).toBe(expected);
  });

  it('con credenziali errate non apre la sessione', () => {
    service.login('mario', 'sbagliata').subscribe({ error: () => undefined });

    http.expectOne('/api/v1/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(service.isAuthenticated()).toBe(false);
    expect(service.authorizationHeader()).toBeNull();
  });

  it('il logout chiude la sessione', () => {
    service.login('mario', 'pass').subscribe();
    http.expectOne('/api/v1/auth/me').flush(USER);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it('al ritorno da Microsoft riprende la sessione dal cookie, senza credenziali salvate', () => {
    let restored: boolean | undefined;
    service.restoreSession().subscribe((value) => (restored = value));

    const request = http.expectOne('/api/v1/auth/me');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(USER);

    expect(restored).toBe(true);
    expect(service.microsoftSession()).toBe(true);
    expect(service.authorizationHeader()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('senza credenziali né sessione Microsoft non entra', () => {
    let restored: boolean | undefined;
    service.restoreSession().subscribe((value) => (restored = value));

    http.expectOne('/api/v1/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(restored).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });

  it("l'uscita da una sessione Microsoft chiude la sessione sul backend e passa da Microsoft", () => {
    service.restoreSession().subscribe();
    http.expectOne('/api/v1/auth/me').flush(USER);

    let target: string | undefined;
    service.signOut().subscribe((value) => (target = value));
    const request = http.expectOne('/logout');
    expect(request.request.method).toBe('POST');
    request.flush({ redirectUrl: 'https://login.microsoftonline.com/t/oauth2/v2.0/logout' });

    expect(target).toBe('https://login.microsoftonline.com/t/oauth2/v2.0/logout');
    expect(service.isAuthenticated()).toBe(false);
  });

  it("l'uscita con utente e password resta nell'app", () => {
    service.login('mario', 'pass').subscribe();
    http.expectOne('/api/v1/auth/me').flush(USER);

    let target: string | undefined;
    service.signOut().subscribe((value) => (target = value));

    expect(target).toBe('/login');
    expect(service.isAuthenticated()).toBe(false);
  });
});
