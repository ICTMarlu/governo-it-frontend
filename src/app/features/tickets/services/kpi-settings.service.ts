import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { UserPreferencesService } from '../../../core/preferences/user-preferences.service';

/** Un KPI o un riquadro delle pagine dei ticket che l'utente può nascondere. */
export interface KpiItem {
  readonly id: string;
  readonly label: string;
}

export interface KpiGroup {
  readonly title: string;
  readonly items: readonly KpiItem[];
}

/**
 * Catalogo dei KPI configurabili, pagina per pagina. Gli id restano stabili: sono salvati nelle
 * preferenze dell'utente (aggiungerne è libero, rinominarli fa ricomparire quelli nascosti).
 */
export const KPI_GROUPS: readonly KpiGroup[] = [
  {
    title: 'Operativa · numeri principali',
    items: [
      { id: 'ops.open', label: 'Ticket aperti' },
      { id: 'ops.flow7', label: 'Entrati / chiusi in 7 giorni' },
      { id: 'ops.today', label: 'Entrati / chiusi oggi (con la media)' },
      { id: 'ops.previous', label: 'Entrati / chiusi ieri (con la media)' },
      { id: 'ops.unassigned', label: 'Senza assegnatario' },
      { id: 'ops.overdue', label: 'Con la scadenza passata' },
      { id: 'ops.priority', label: 'Priorità più alte (Highest e High)' },
      { id: 'ops.impact', label: 'Impatto più alto (Extensive e Significant)' },
      { id: 'ops.waiting', label: 'In attesa del cliente' },
      { id: 'ops.stale', label: 'Fermi senza aggiornamenti' },
      { id: 'ops.age', label: 'Età media degli aperti' },
      { id: 'ops.withProject', label: 'Aperti con codice progetto' },
    ],
  },
  {
    title: 'Operativa · allerte',
    items: [
      { id: 'alert.SPIKE', label: 'Picco di richieste' },
      { id: 'alert.BALANCE', label: 'Saldo che peggiora' },
      { id: 'alert.DUE_SOON', label: 'Scadenze vicine' },
      { id: 'alert.NO_RESPONSE', label: 'Nuovi senza risposta' },
      { id: 'alert.CONCENTRATION', label: 'Carico concentrato su una persona' },
    ],
  },
  {
    title: 'Operativa · riquadri',
    items: [
      { id: 'ops.advice', label: 'Azioni consigliate' },
      { id: 'ops.flows', label: 'Flussi settimanali' },
      { id: 'ops.people', label: 'Carico per persona' },
      { id: 'ops.areas', label: 'Per area' },
      { id: 'ops.projects', label: 'Per progetto' },
    ],
  },
  {
    title: 'Panoramica',
    items: [
      { id: 'bi.created', label: 'Ticket creati' },
      { id: 'bi.open', label: 'Aperti' },
      { id: 'bi.workable', label: 'Open (lavorabili)' },
      { id: 'bi.pending', label: 'Pending' },
      { id: 'bi.resolved', label: 'Risolti' },
    ],
  },
  {
    title: 'Trend',
    items: [
      { id: 'trend.backlogDays', label: 'Giorni lavorativi di backlog' },
      { id: 'trend.workable', label: 'Lavorabili oggi' },
    ],
  },
  {
    title: 'Persone',
    items: [
      { id: 'people.table', label: 'Backlog per persona (saldo a settimana)' },
      { id: 'people.chart', label: 'Trend entrati e chiusi della persona' },
    ],
  },
];

const PREFERENCE_KEY = 'tickets.kpis';

/**
 * KPI nascosti dall'utente nelle pagine dei ticket: di partenza si vede tutto. La scelta è
 * salvata sul server nelle preferenze, quindi segue l'utente su ogni PC.
 */
@Injectable({ providedIn: 'root' })
export class KpiSettingsService {
  private readonly preferences = inject(UserPreferencesService);
  private readonly hiddenIds = signal<ReadonlySet<string>>(new Set());
  private loaded = false;

  readonly hidden = this.hiddenIds.asReadonly();
  readonly hiddenCount = computed(() => this.hiddenIds().size);

  /** Legge la scelta salvata (una volta sola per sessione). */
  load(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    this.preferences.get<{ hidden?: readonly string[] }>(PREFERENCE_KEY).subscribe({
      next: (saved) => this.hiddenIds.set(new Set(saved?.hidden ?? [])),
      // Senza preferenze leggibili si mostra tutto
      error: () => (this.loaded = false),
    });
  }

  visible(id: string): boolean {
    return !this.hiddenIds().has(id);
  }

  save(hidden: ReadonlySet<string>): Observable<void> {
    return this.preferences
      .save(PREFERENCE_KEY, { hidden: [...hidden].sort() })
      .pipe(tap(() => this.hiddenIds.set(new Set(hidden))));
  }
}
