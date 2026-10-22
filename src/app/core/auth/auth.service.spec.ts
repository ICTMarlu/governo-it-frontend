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
});
