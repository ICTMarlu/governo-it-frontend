import { describe, expect, it } from 'vitest';

import { viewAsOptions, viewAsParams } from './home-view-as';

describe('vedi la home come', () => {
  it('elenca gli altri utenti attivi e le persone senza utente', () => {
    const options = viewAsOptions(
      [
        {
          id: 1,
          displayName: 'Amministratore',
          roleLabel: 'Admin',
          resourceId: 9,
          resourceName: 'Gioele',
          active: true,
        },
        {
          id: 2,
          displayName: 'Elia',
          roleLabel: 'PM',
          resourceId: 3,
          resourceName: 'Elia',
          active: true,
        },
        {
          id: 3,
          displayName: 'Ospite',
          roleLabel: 'Viewer',
          resourceId: null,
          resourceName: null,
          active: true,
        },
        {
          id: 4,
          displayName: 'Vecchio',
          roleLabel: 'Editor',
          resourceId: null,
          resourceName: null,
          active: false,
        },
      ],
      [
        { id: 3, fullName: 'Elia', active: true },
        { id: 7, fullName: 'Francesco', active: true },
        { id: 8, fullName: 'Andrea', active: false },
        { id: 9, fullName: 'Gioele', active: true },
      ],
      1,
    );

    expect(options.users.map((o) => [o.key, o.name, o.hint])).toEqual([
      ['u2', 'Elia', 'PM'],
      ['u3', 'Ospite', 'Viewer, senza persona collegata'],
    ]);
    expect(options.people.map((o) => o.key)).toEqual(['r7']);
  });

  it('trasforma la scelta nei parametri delle chiamate', () => {
    expect(viewAsParams('u12')).toEqual({ asUser: '12' });
    expect(viewAsParams('r7')).toEqual({ asResource: '7' });
    expect(viewAsParams(null)).toEqual({});
    expect(viewAsParams('x1')).toEqual({});
  });
});
