import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { FocusPersonService } from './focus-person.service';

describe('FocusPersonService', () => {
  const user = signal<{ role: string; resourceId: number | null } | null>(null);

  function create(role: string, resourceId: number | null): FocusPersonService {
    user.set({ role, resourceId });
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { currentUser: user } }],
    });
    return TestBed.inject(FocusPersonService);
  }

  beforeEach(() => sessionStorage.clear());

  it('Admin e PM scelgono la persona e la scelta resta per la sessione', () => {
    const admin = create('ADMIN', 1);
    expect(admin.canChoose()).toBe(true);
    expect(admin.resourceId()).toBeNull();
    admin.set(7);
    expect(admin.resourceId()).toBe(7);
    expect(sessionStorage.getItem('governo-it.focus-person')).toBe('7');
    admin.set(null);
    expect(admin.resourceId()).toBeNull();
    expect(sessionStorage.getItem('governo-it.focus-person')).toBeNull();
  });

  it('gli altri ruoli restano fissi sulla propria persona', () => {
    sessionStorage.setItem('governo-it.focus-person', '7');
    const editor = create('EDITOR', 30);
    expect(editor.canChoose()).toBe(false);
    expect(editor.resourceId()).toBe(30);
    editor.set(9);
    expect(editor.resourceId()).toBe(30);
  });
});
