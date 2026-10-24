import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription, interval } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { canEdit } from '../../../core/auth/permissions';
import { API_BASE_URL } from '../../../core/config/api.config';
import { errorMessage } from '../../../shared/crud/crud-api.service';
import { TicketSync, sinceLabel } from '../models/ticket.model';

/** Ogni quanto le pagine dei ticket controllano se Jira è stato aggiornato (anche in automatico). */
const CHECK_EVERY_MS = 60_000;
/** Ogni quanto si ricalcola "aggiornato x min fa". */
const CLOCK_EVERY_MS = 30_000;

/**
 * Aggiornamento da Jira condiviso da tutte le pagine dei ticket (Operativa e BI). "Aggiorna"
 * chiede a Jira i ticket cambiati e, finito, fa ricaricare tutte le pagine ({@code version}).
 * Mentre si è nella sezione, ogni minuto si controlla anche l'aggiornamento automatico del
 * backend (ogni 5 minuti): se è arrivato qualcosa di nuovo le pagine si ricaricano da sole.
 */
@Injectable({ providedIn: 'root' })
export class TicketSyncService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly currentUser = inject(AuthService).currentUser;
  private readonly url = `${inject(API_BASE_URL)}/tickets/sync`;

  /** Stato dell'ultimo aggiornamento noto. */
  readonly status = signal<TicketSync | null>(null);
  /** Aumenta a ogni aggiornamento riuscito: le pagine lo osservano e ricaricano i dati. */
  readonly version = signal(0);
  readonly syncing = signal(false);
  private readonly now = signal(Date.now());

  /** Admin e PM chiedono l'aggiornamento a Jira; gli altri ricaricano i dati già copiati. */
  readonly canSync = computed(() => canEdit(this.currentUser()?.permissions, 'TICKETS'));

  /** "Aggiornato da Jira 3 min fa", sempre attuale. */
  readonly sinceText = computed(() =>
    sinceLabel(this.status()?.lastSuccessAt ?? null, new Date(this.now())),
  );

  private watchers = 0;
  private timers: Subscription | null = null;

  /** La sezione ticket si apre: parte il controllo periodico (una volta sola per tutte le pagine). */
  watch(): void {
    if (this.watchers++ > 0) {
      return;
    }
    this.check();
    this.timers = interval(CHECK_EVERY_MS).subscribe(() => this.check());
    this.timers.add(interval(CLOCK_EVERY_MS).subscribe(() => this.now.set(Date.now())));
  }

  unwatch(): void {
    if (--this.watchers > 0) {
      return;
    }
    this.watchers = 0;
    this.timers?.unsubscribe();
    this.timers = null;
  }

  /** Stato ricevuto insieme ai dati di una pagina: lo allinea senza far ricaricare le altre. */
  known(status: TicketSync): void {
    const current = this.status();
    if (!current || newer(status, current)) {
      this.status.set(status);
    }
    this.now.set(Date.now());
  }

  /** Aggiorna da Jira (Admin e PM) o ricarica i dati già copiati; poi ricaricano tutte le pagine. */
  refresh(full = false): void {
    if (this.syncing()) {
      return;
    }
    if (!this.canSync()) {
      this.version.update((v) => v + 1);
      return;
    }
    this.syncing.set(true);
    this.http.post<TicketSync>(this.url, null, { params: { full } }).subscribe({
      next: (status) => {
        this.syncing.set(false);
        this.status.set(status);
        this.now.set(Date.now());
        this.version.update((v) => v + 1);
        this.snackBar.open(
          status.lastSucceeded
            ? `Aggiornato da Jira · ${status.lastMessage ?? ''}`
            : (status.lastMessage ?? 'Aggiornamento da Jira non riuscito'),
          'OK',
          { duration: 5000 },
        );
      },
      error: (error: unknown) => {
        this.syncing.set(false);
        this.snackBar.open(errorMessage(error), 'OK', { duration: 6000 });
      },
    });
  }

  /** Controllo periodico: se il backend ha aggiornato da Jira (anche in automatico) le pagine ricaricano. */
  private check(): void {
    this.http.get<TicketSync>(this.url).subscribe({
      next: (status) => {
        const current = this.status();
        this.status.set(status);
        this.now.set(Date.now());
        if (current && newer(status, current)) {
          this.version.update((v) => v + 1);
        }
      },
      error: () => undefined,
    });
  }
}

function newer(a: TicketSync, b: TicketSync): boolean {
  return (
    (a.lastSuccessAt ?? '') > (b.lastSuccessAt ?? '') || (a.lastRunAt ?? '') > (b.lastRunAt ?? '')
  );
}
