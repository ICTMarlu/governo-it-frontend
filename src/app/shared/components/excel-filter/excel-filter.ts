import { Component, computed, input, output, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { matchesTerms, searchTerms } from '../../util/text-search';

export interface ExcelFilterOption {
  readonly value: string;
  readonly label: string;
}

/** Scorciatoia nel menu del filtro (es. "Solo aperti"). */
export interface ExcelFilterPreset {
  readonly label: string;
  /** Valori selezionati dal preset; null = nessun filtro. */
  readonly values: readonly string[] | null;
}

/** Direzione dell'ordinamento chiesto dal menu del filtro. */
export type ExcelSortDirection = 'asc' | 'desc';

/**
 * Filtro come l'AutoFiltro di Excel: un campo di ricerca che restringe l'elenco mentre scrivi
 * (testo "contenuto in") e caselle da spuntare che filtrano subito. La ricerca non cambia le
 * spunte già messe; "Seleziona visibili" e "Togli visibili" agiscono solo sulle voci trovate.
 * {@code selected} null = nessun filtro (tutte le voci). Con {@code sortable} in cima al menu
 * ci sono "Ordina crescente" e "Ordina decrescente", come in Excel.
 */
@Component({
  selector: 'gov-excel-filter',
  imports: [MatButtonModule, MatCheckboxModule, MatIconModule, MatMenuModule, MatTooltipModule],
  template: `
    <button
      type="button"
      class="trigger"
      [class.trigger--active]="active()"
      [class.trigger--compact]="compact()"
      [matMenuTriggerFor]="menu"
      [attr.aria-label]="'Filtro ' + label() + ': ' + summary()"
      [matTooltip]="'Filtro ' + label() + ': ' + summary()"
      (menuOpened)="onOpen(searchBox)"
    >
      @if (!compact()) {
        <span class="trigger__label">{{ label() }}:</span>
        <span class="trigger__value">{{ summary() }}</span>
      }
      <mat-icon aria-hidden="true">{{ active() ? 'filter_alt' : 'filter_list' }}</mat-icon>
    </button>

    <mat-menu #menu="matMenu" class="excel-filter-menu" xPosition="before">
      <div
        class="panel"
        role="group"
        [attr.aria-label]="'Filtro ' + label()"
        (click)="$event.stopPropagation()"
        (keydown)="onPanelKey($event)"
      >
        @if (sortable()) {
          <div class="panel__sort">
            @for (choice of sortChoices(); track choice.direction) {
              <button
                mat-button
                type="button"
                [class.panel__sort--on]="sortDirection() === choice.direction"
                [attr.aria-pressed]="sortDirection() === choice.direction"
                (click)="chooseSort(choice.direction)"
              >
                <mat-icon aria-hidden="true">{{ choice.icon }}</mat-icon>
                {{ choice.label }}
              </button>
            }
          </div>
        }
        <input
          #searchBox
          class="panel__search"
          type="search"
          placeholder="Cerca…"
          [attr.aria-label]="'Cerca in ' + label()"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
        <div class="panel__actions">
          <button mat-button type="button" (click)="selectVisible(true)">Seleziona visibili</button>
          <button mat-button type="button" (click)="selectVisible(false)">Togli visibili</button>
        </div>
        @for (preset of presets(); track preset.label) {
          <button mat-button type="button" class="panel__preset" (click)="apply(preset.values)">
            {{ preset.label }}
          </button>
        }
        <div class="panel__list">
          @for (option of visibleOptions(); track option.value) {
            <mat-checkbox
              [checked]="isChecked(option.value)"
              (change)="toggle(option.value, $event.checked)"
            >
              {{ option.label }}
            </mat-checkbox>
          } @empty {
            <p class="panel__empty">Nessuna voce</p>
          }
        </div>
        <div class="panel__footer">
          <span class="panel__count">{{ checkedCount() }} di {{ options().length }}</span>
          <button mat-button type="button" [disabled]="!active()" (click)="apply(null)">
            Togli filtro
          </button>
        </div>
      </div>
    </mat-menu>
  `,
  styles: `
    :host {
      display: inline-flex;
      min-width: 0;
    }

    .trigger {
      width: 100%;
    }

    .trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      height: 2rem;
      min-width: 0;
      max-width: 16rem;
      overflow: hidden;
      padding: 0 0.5rem;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 0.5rem;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-label-large);
      cursor: pointer;

      mat-icon {
        flex-shrink: 0;
        width: 1.125rem;
        height: 1.125rem;
        font-size: 1.125rem;
      }

      &:hover {
        background: var(--mat-sys-surface-container-high);
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
      }

      &--active {
        border-color: var(--mat-sys-primary);
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }

      &--compact {
        height: 1.5rem;
        padding: 0 0.125rem;
        border: 0;
        background: transparent;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .trigger--compact.trigger--active {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }

    // L'etichetta non va mai a capo: se il valore è lungo si tronca lui, non cambia l'altezza
    .trigger__label {
      flex-shrink: 0;
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
    }

    .trigger__value {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      width: 17rem;
      padding: 0.5rem 0.75rem;
    }

    .panel__search {
      box-sizing: border-box;
      width: 100%;
      height: 2.25rem;
      padding: 0 0.5rem;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 0.375rem;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-medium);

      &:focus {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: -1px;
      }
    }

    .panel__actions,
    .panel__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .panel__sort {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding-bottom: 0.25rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .panel__sort--on {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }

    .panel__preset {
      align-self: flex-start;
    }

    .panel__list {
      display: flex;
      flex-direction: column;
      max-height: 16rem;
      overflow: auto;
      border-block: 1px solid var(--mat-sys-outline-variant);
    }

    .panel__empty,
    .panel__count {
      margin: 0.5rem 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class ExcelFilter {
  readonly label = input.required<string>();
  readonly options = input.required<readonly ExcelFilterOption[]>();
  /** Valori selezionati; null = nessun filtro. */
  readonly selected = input<readonly string[] | null>(null);
  readonly presets = input<readonly ExcelFilterPreset[]>([]);
  /** Solo l'icona (per le intestazioni di colonna). */
  readonly compact = input(false);
  /** Testo del pulsante al posto del riepilogo automatico (es. "Aperti"). */
  readonly summaryText = input<string | null>(null);
  /** Spuntate tutte = nessun filtro (false quando il default non è "tutti", es. stato: solo aperti). */
  readonly allMeansNoFilter = input(true);

  /**
   * Filtro attivo (imbuto pieno, "Togli filtro" abilitato) quando le spunte di partenza non
   * sono "tutte" (es. Persone: solo le attive); null = attivo se {@code selected} non è null.
   */
  readonly filtered = input<boolean | null>(null);
  /** Mostra "Ordina crescente/decrescente" in cima al menu. */
  readonly sortable = input(false);
  /** Ordinamento attuale della colonna; null = non ordinata. */
  readonly sortDirection = input<ExcelSortDirection | null>(null);
  /** Testi delle due voci (es. "1 → 4" per la priorità). */
  readonly sortAscLabel = input('Ordina dalla A alla Z');
  readonly sortDescLabel = input('Ordina dalla Z alla A');

  readonly selectedChange = output<readonly string[] | null>();
  /** Ordinamento scelto; null = toglie l'ordinamento della colonna (secondo clic sulla voce attiva). */
  readonly sortChange = output<ExcelSortDirection | null>();

  private readonly trigger = viewChild.required(MatMenuTrigger);

  protected readonly sortChoices = computed(() => [
    { direction: 'asc' as const, icon: 'arrow_upward', label: this.sortAscLabel() },
    { direction: 'desc' as const, icon: 'arrow_downward', label: this.sortDescLabel() },
  ]);

  protected readonly query = signal('');

  protected readonly active = computed(() => this.filtered() ?? this.selected() !== null);

  private readonly checked = computed(
    () => new Set(this.selected() ?? this.options().map((option) => option.value)),
  );

  protected readonly checkedCount = computed(
    () => this.options().filter((option) => this.checked().has(option.value)).length,
  );

  /** Voci trovate dalla ricerca: maiuscole, accenti e spazi in più non contano. */
  protected readonly visibleOptions = computed(() => {
    const terms = searchTerms(this.query());
    return this.options().filter((option) => matchesTerms(terms, [option.label]));
  });

  protected readonly summary = computed(() => {
    const selected = this.selected();
    if (this.summaryText()) {
      return this.summaryText()!;
    }
    if (selected === null) {
      return 'Tutti';
    }
    const labels = this.options()
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label);
    if (labels.length === 0) {
      return 'Nessuno';
    }
    return labels.length === 1 ? labels[0] : `${labels[0]} +${labels.length - 1}`;
  });

  protected isChecked(value: string): boolean {
    return this.checked().has(value);
  }

  protected onOpen(searchBox: HTMLInputElement): void {
    this.query.set('');
    setTimeout(() => searchBox.focus());
  }

  /** Il menu di Material intercetta le lettere per la navigazione: nel campo di ricerca servono a scrivere. */
  protected onPanelKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' && event.key !== 'Tab') {
      event.stopPropagation();
    }
  }

  protected toggle(value: string, checked: boolean): void {
    const next = new Set(this.checked());
    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    this.emit(next);
  }

  protected selectVisible(checked: boolean): void {
    const next = new Set(this.checked());
    for (const option of this.visibleOptions()) {
      if (checked) {
        next.add(option.value);
      } else {
        next.delete(option.value);
      }
    }
    this.emit(next);
  }

  protected apply(values: readonly string[] | null): void {
    this.selectedChange.emit(values === null ? null : [...values]);
  }

  /** Tutte spuntate = nessun filtro. */
  private emit(values: Set<string>): void {
    const all = this.options().every((option) => values.has(option.value));
    this.selectedChange.emit(all && this.allMeansNoFilter() ? null : [...values]);
  }

  /** Come in Excel il menu si chiude; la voce già attiva toglie l'ordinamento. */
  protected chooseSort(direction: ExcelSortDirection): void {
    this.sortChange.emit(this.sortDirection() === direction ? null : direction);
    this.trigger().closeMenu();
  }
}
