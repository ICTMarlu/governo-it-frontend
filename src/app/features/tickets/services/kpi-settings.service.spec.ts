import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { UserPreferencesService } from '../../../core/preferences/user-preferences.service';
import { KPI_GROUPS, KpiSettingsService } from './kpi-settings.service';

describe('KpiSettingsService', () => {
  const preferences = {
    get: vi.fn(),
    save: vi.fn(() => of(undefined)),
  };

  beforeEach(() => {
    preferences.get.mockReset();
    preferences.save.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: UserPreferencesService, useValue: preferences }],
    });
  });

  it('di partenza mostra tutto, poi nasconde quelli salvati', () => {
    preferences.get.mockReturnValue(of(null));
    const service = TestBed.inject(KpiSettingsService);
    service.load();
    expect(service.visible('ops.open')).toBe(true);

    service.save(new Set(['ops.open', 'alert.SPIKE'])).subscribe();

    expect(preferences.save).toHaveBeenCalledWith('tickets.kpis', {
      hidden: ['alert.SPIKE', 'ops.open'],
    });
    expect(service.visible('ops.open')).toBe(false);
    expect(service.hiddenCount()).toBe(2);
  });

  it('legge la scelta salvata una volta sola', () => {
    preferences.get.mockReturnValue(of({ hidden: ['bi.pending'] }));
    const service = TestBed.inject(KpiSettingsService);
    service.load();
    service.load();

    expect(preferences.get).toHaveBeenCalledTimes(1);
    expect(service.visible('bi.pending')).toBe(false);
  });

  it('ha id unici in tutto il catalogo', () => {
    const ids = KPI_GROUPS.flatMap((group) => group.items.map((item) => item.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
