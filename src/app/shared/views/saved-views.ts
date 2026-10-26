import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, filter, switchMap } from 'rxjs';

import { ConfirmDialog, ConfirmDialogData } from '../crud/confirm-dialog/confirm-dialog';
import { errorMessage } from '../crud/crud-api.service';
import { SaveViewDialog, SaveViewDialogData, SaveViewDialogResult } from './save-view-dialog';
import { SavedView, SavedViewsService } from './saved-views.service';

/**
 * Viste salvate di una pagina (D-26), come le visualizzazioni di Excel: si salvano con un nome i
 * filtri, le colonne e l'ordinamento attuali e si richiamano dal menu; una può essere la
 * predefinita e si applica all'apertura della pagina. La pagina passa il suo stato in
 * {@code state} e applica quello ricevuto da {@code apply} (null = vista standard).
 */
@Component({
  selector: 'gov-saved-views',
  imports: [MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatTooltipModule],
  template: `
    <button
      mat-button
      type="button"
      class="trigger"
      [matMenuTriggerFor]="menu"
      [matTooltip]="changed() ? 'Filtri o colonne cambiati rispetto alla vista' : 'Viste salvate'"
      [attr.aria-label]="
        'Vista: ' + label() + (changed() ? ', modificata' : '') + '. Apri le viste salvate'
      "
    >
      <mat-icon aria-hidden="true">bookmarks</mat-icon>
      {{ compact() ? label() : 'Vista: ' + label() }}
      @if (changed()) {
        <span class="trigger__dot" aria-hidden="true">•</span>
      }
    </button>
    <mat-menu #menu="matMenu" class="saved-views-menu">
      <button
        mat-menu-item
        type="button"
        role="menuitemradio"
        [attr.aria-checked]="current() === null"
        (click)="applyStandard()"
      >
        <mat-icon aria-hidden="true">{{ current() === null ? 'check' : 'restart_alt' }}</mat-icon>
        Vista standard
      </button>
      @for (view of views(); track view.id) {
        <button
          mat-menu-item
          type="button"
          role="menuitemradio"
          [attr.aria-checked]="current()?.id === view.id"
          (click)="applyView(view)"
        >
          <mat-icon aria-hidden="true">{{
            current()?.id === view.id ? 'check' : 'bookmark_border'
          }}</mat-icon>
          {{ view.name }}
          @if (view.defaultView) {
            <span class="default-mark">· predefinita</span>
          }
        </button>
      }
      <mat-divider />
      <button mat-menu-item type="button" (click)="saveAsNew()">
        <mat-icon aria-hidden="true">add</mat-icon>
        Salva come nuova vista…
      </button>
      @if (current(); as view) {
        <button mat-menu-item type="button" [disabled]="!changed()" (click)="updateCurrent(view)">
          <mat-icon aria-hidden="true">save</mat-icon>
          Aggiorna «{{ view.name }}» con i filtri attuali
        </button>
        <button mat-menu-item type="button" (click)="toggleDefault(view)">
          <mat-icon aria-hidden="true">{{ view.defaultView ? 'star' : 'star_border' }}</mat-icon>
          {{ view.defaultView ? 'Non più predefinita' : 'Imposta come predefinita' }}
        </button>
        <button mat-menu-item type="button" (click)="rename(view)">
          <mat-icon aria-hidden="true">edit</mat-icon>
          Rinomina…
        </button>
        <button mat-menu-item type="button" (click)="remove(view)">
          <mat-icon aria-hidden="true">delete</mat-icon>
          Elimina
        </button>
      }
    </mat-menu>
  `,
  styles: `
    .trigger__dot {
      margin-inline-start: 0.125rem;
      color: var(--mat-sys-primary);
      font-weight: 700;
    }

    .default-mark {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-small);
    }
  `,
})
export class SavedViews {
  private readonly service = inject(SavedViewsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Pagina (es. "plan", "list.projects"): le viste sono per pagina e per utente. */
  readonly page = input.required<string>();
  /** Solo il nome della vista, senza "Vista:" (barre strette). */
  readonly compact = input(false);
  /** Stato attuale della pagina, salvato così com'è (JSON). */
  readonly state = input.required<unknown>();
  /** Stato da applicare; null = vista standard (filtri e colonne di partenza). */
  readonly apply = output<unknown | null>();

  protected readonly views = signal<SavedView[]>([]);
  protected readonly current = signal<SavedView | null>(null);

  protected readonly label = computed(() => this.current()?.name ?? 'standard');
  /** I filtri o le colonne sono cambiati rispetto alla vista scelta. */
  protected readonly changed = computed(() => {
    const view = this.current();
    return view !== null && stableJson(view.state) !== stableJson(this.state());
  });

  constructor() {
    // Alla prima apertura della pagina si applica la vista predefinita, se c'è
    effect(() => {
      const page = this.page();
      untracked(() => this.load(page, true));
    });
  }

  protected applyStandard(): void {
    this.reset();
  }

  /** Torna alla vista standard (anche dalla pagina, es. "Togli filtri"). */
  reset(): void {
    this.current.set(null);
    this.apply.emit(null);
  }

  protected applyView(view: SavedView): void {
    this.current.set(view);
    this.apply.emit(view.state);
  }

  protected saveAsNew(): void {
    this.askName({
      title: 'Salva la vista',
      name: '',
      askDefault: true,
      existingNames: this.names(),
    })
      .pipe(
        switchMap((result) =>
          this.service.save(this.page(), result.name, this.state(), result.defaultView),
        ),
      )
      .subscribe({
        next: (saved) => this.done(saved, `Vista «${saved.name}» salvata`),
        error: (e) => this.fail(e),
      });
  }

  protected updateCurrent(view: SavedView): void {
    this.service.update(view.id, view.name, this.state()).subscribe({
      next: (saved) => this.done(saved, `Vista «${saved.name}» aggiornata`),
      error: (e) => this.fail(e),
    });
  }

  protected toggleDefault(view: SavedView): void {
    this.service.setDefault(view.id, !view.defaultView).subscribe({
      next: (saved) =>
        this.done(
          saved,
          saved.defaultView ? `«${saved.name}» si aprirà da sola` : 'Nessuna vista predefinita',
        ),
      error: (e) => this.fail(e),
    });
  }

  protected rename(view: SavedView): void {
    this.askName({
      title: 'Rinomina la vista',
      name: view.name,
      askDefault: false,
      existingNames: this.names(),
    })
      .pipe(switchMap((result) => this.service.update(view.id, result.name)))
      .subscribe({
        next: (saved) => this.done(saved, 'Vista rinominata'),
        error: (e) => this.fail(e),
      });
  }

  protected remove(view: SavedView): void {
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          title: 'Eliminare la vista?',
          message: `La vista «${view.name}» sparisce; i dati non cambiano.`,
          confirmLabel: 'Elimina',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.service.delete(view.id)),
      )
      .subscribe({
        next: () => {
          this.current.set(null);
          this.load(this.page(), false);
        },
        error: (e) => this.fail(e),
      });
  }

  private askName(data: SaveViewDialogData): Observable<SaveViewDialogResult> {
    return this.dialog
      .open<SaveViewDialog, SaveViewDialogData, SaveViewDialogResult>(SaveViewDialog, {
        data,
        maxWidth: '100vw',
      })
      .afterClosed()
      .pipe(filter((result): result is SaveViewDialogResult => result !== undefined));
  }

  private done(saved: SavedView, message: string): void {
    this.current.set(saved);
    this.snackBar.open(message, undefined, { duration: 2500 });
    this.load(this.page(), false);
  }

  private fail(error: unknown): void {
    this.snackBar.open(errorMessage(error), 'OK', { duration: 6000 });
  }

  private names(): string[] {
    return this.views().map((view) => view.name);
  }

  private load(page: string, applyDefault: boolean): void {
    this.service.list(page).subscribe({
      next: (views) => {
        this.views.set(views);
        const current = this.current();
        if (current) {
          this.current.set(views.find((view) => view.id === current.id) ?? null);
        }
        const preferred = views.find((view) => view.defaultView);
        if (applyDefault && preferred) {
          this.applyView(preferred);
        }
      },
      error: () => this.views.set([]),
    });
  }
}

/** JSON con le chiavi in ordine, per confrontare due stati. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
}
