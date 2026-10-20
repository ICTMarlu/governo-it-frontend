import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { API_BASE_URL } from '../../core/config/api.config';
import { BackLink } from '../../shared/components/back-link/back-link';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { ROLES } from '../../shared/crud/crud.model';
import { PROJECT_CODES_HELP } from '../../shared/help/help-content';

interface SystemNextCode {
  readonly mainSystemId: number;
  readonly mainSystemLabel: string;
  readonly shortCode: string | null;
  readonly nextCode: string | null;
  readonly projectsWithoutCode: number;
}

interface CodeCounter {
  readonly year: number;
  readonly lastValue: number;
  readonly nextValue: number;
  readonly projectsWithoutCode: number;
  readonly systems: readonly SystemNextCode[];
}

interface GenerateResult {
  readonly assigned: number;
  readonly withoutShortCode: number;
  readonly systemsWithoutShortCode: readonly string[];
}

/**
 * Contatore unico dei codici progetto (D-06): numero dell'anno condiviso da tutti i sistemi,
 * prossimo codice per sistema, assegnazione dei codici ai progetti che ne sono privi.
 */
@Component({
  selector: 'gov-project-codes-page',
  imports: [
    FormsModule,
    BackLink,
    PageHeader,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './project-codes-page.html',
  styleUrl: './project-codes-page.scss',
})
export class ProjectCodesPage {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/project-codes`;
  private readonly snackBar = inject(MatSnackBar);
  private readonly currentUser = inject(AuthService).currentUser;

  protected readonly counter = signal<CodeCounter | null>(null);
  protected readonly editValue = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly result = signal<GenerateResult | null>(null);
  protected readonly help = PROJECT_CODES_HELP;
  protected readonly isAdmin = computed(() => this.currentUser()?.role === ROLES.admin);
  /** Codici brevi in modifica, per id del sistema. */
  protected readonly shortCodes = signal<Record<number, string>>({});

  protected shortCodeChanged(system: SystemNextCode): boolean {
    const edited = (this.shortCodes()[system.mainSystemId] ?? '').trim().toUpperCase();
    return edited !== (system.shortCode ?? '');
  }

  protected setShortCodeDraft(system: SystemNextCode, value: string): void {
    this.shortCodes.update((current) => ({ ...current, [system.mainSystemId]: value }));
  }

  protected saveShortCode(system: SystemNextCode): void {
    const value = (this.shortCodes()[system.mainSystemId] ?? '').trim().toUpperCase();
    if (value && !/^[A-Z0-9]{2,5}$/.test(value)) {
      this.snackBar.open('Codice breve: da 2 a 5 lettere o numeri (es. ERP)', 'Chiudi');
      return;
    }
    this.busy.set(true);
    this.http
      .put<CodeCounter>(`${this.url}/systems/${system.mainSystemId}/short-code`, {
        shortCode: value || null,
      })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (counter) => {
          this.setCounter(counter);
          this.snackBar.open(`Codice breve di ${system.mainSystemLabel} salvato`, 'OK', {
            duration: 3000,
          });
        },
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  constructor() {
    this.load();
  }

  protected saveCounter(): void {
    const value = this.editValue();
    if (value === null || value < 0 || value > 999) {
      this.snackBar.open('Il contatore va da 0 a 999', 'Chiudi');
      return;
    }
    this.busy.set(true);
    this.http
      .put<CodeCounter>(`${this.url}/counter`, { lastValue: value })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (counter) => {
          this.setCounter(counter);
          this.snackBar.open('Contatore aggiornato', 'OK', { duration: 3000 });
        },
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  protected generateMissing(): void {
    this.busy.set(true);
    this.http
      .post<GenerateResult>(`${this.url}/generate-missing`, {})
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.load();
        },
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  private load(): void {
    this.http.get<CodeCounter>(`${this.url}/counter`).subscribe({
      next: (counter) => this.setCounter(counter),
      error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
    });
  }

  private setCounter(counter: CodeCounter): void {
    this.counter.set(counter);
    this.editValue.set(counter.lastValue);
    this.shortCodes.set(
      Object.fromEntries(
        counter.systems.map((system) => [system.mainSystemId, system.shortCode ?? '']),
      ),
    );
  }
}
