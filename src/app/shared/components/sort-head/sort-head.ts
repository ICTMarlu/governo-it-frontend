import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Ordinamento attuale di una tabella: colonna e direzione. */
export interface HeadSort {
  readonly key: string;
  readonly desc: boolean;
}

/** Valore di aria-sort per la cella d'intestazione della colonna {@code key}. */
export function ariaSortOf(
  sort: HeadSort | null,
  key: string,
): 'ascending' | 'descending' | 'none' {
  return sort?.key !== key ? 'none' : sort.desc ? 'descending' : 'ascending';
}

/**
 * Titolo di colonna cliccabile per ordinare (da mettere dentro un th): mostra la freccia della direzione
 * sulla colonna in uso e una freccia leggera sulle altre, così si vede che si possono ordinare tutte.
 * Il clic emette la chiave; chi ospita la tabella decide la direzione e rimette il suo ordinamento di partenza.
 */
@Component({
  selector: 'gov-sort-head',
  imports: [MatIconModule],
  template: `
    <button type="button" class="head" [class.head--on]="active()" (click)="sorted.emit(key())">
      <ng-content />
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
    </button>
  `,
  styles: `
    .head {
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      white-space: inherit;
      cursor: pointer;

      mat-icon {
        flex-shrink: 0;
        width: 1rem;
        height: 1rem;
        font-size: 1rem;
        opacity: 0.4;
      }

      &:hover mat-icon,
      &:focus-visible mat-icon,
      &--on mat-icon {
        opacity: 1;
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    }
  `,
})
export class SortHead {
  readonly key = input.required<string>();
  readonly sort = input<HeadSort | null>(null);
  readonly sorted = output<string>();

  protected readonly active = computed(() => this.sort()?.key === this.key());
  protected readonly icon = computed(() => {
    const sort = this.sort();
    if (sort?.key !== this.key()) {
      return 'unfold_more';
    }
    return sort.desc ? 'arrow_downward' : 'arrow_upward';
  });
}
