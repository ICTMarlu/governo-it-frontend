import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EntityRow } from '../../shared/crud/crud.model';

/**
 * Elenco di tecnologie con il motivo per cui sono in lista: la priorità a sinistra come barra
 * colorata, poi nome e versione, sistemi, fine supporto e i motivi, uno per riga.
 */
@Component({
  selector: 'gov-technology-priority-list',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    @if (items().length === 0) {
      <p class="empty">{{ emptyText() }}</p>
    } @else {
      <ul class="list">
        @for (item of items(); track item.id) {
          <li class="item" [style.--prio-color]="item['priorityColor']">
            <div class="item__main">
              <div class="item__head">
                <strong class="item__name">{{ item['name'] }}</strong>
                @if (item['softwareVersion']) {
                  <span class="item__version">{{ item['softwareVersion'] }}</span>
                }
                <span class="badge">{{ item['priorityLabel'] }}</span>
                @if (item['exposure'] === 'INTERNET') {
                  <span
                    class="web"
                    matTooltip="Raggiungibile da internet: conta con una criticità in più"
                  >
                    <mat-icon aria-hidden="true">public</mat-icon>internet
                  </span>
                }
                <span class="item__crit" [matTooltip]="'Criticità per il business'">
                  criticità {{ lower(item['businessCriticalityLabel']) }}
                </span>
              </div>
              <p class="item__meta">
                {{ systems(item) }}
                @if (item['hosts']) {
                  · {{ item['hosts'] }}
                }
                @if (item['ownerName']) {
                  · referente {{ item['ownerName'] }}
                }
              </p>
              <ul class="reasons">
                @for (reason of reasons(item); track $index) {
                  <li>{{ reason }}</li>
                }
              </ul>
            </div>
            @if (canEdit()) {
              <button
                mat-stroked-button
                type="button"
                class="item__action"
                [attr.aria-label]="'Apri ' + item['name']"
                (click)="open.emit(item)"
              >
                <mat-icon aria-hidden="true">edit</mat-icon>
                Apri
              </button>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .empty {
      margin: 1.5rem 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 1rem 0;
      padding: 0;
      list-style: none;
    }

    .item {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-inline-start: 6px solid var(--prio-color, var(--mat-sys-outline));
      border-radius: 0.5rem;

      &__head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0.25rem 0.75rem;
      }

      &__name {
        font: var(--mat-sys-title-medium);
      }

      &__version {
        font: var(--mat-sys-label-large);
      }

      &__crit {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-medium);
      }

      &__meta {
        margin: 0.125rem 0 0.25rem;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }

      &__action {
        flex-shrink: 0;
      }
    }

    // Priorità: etichetta nel colore della barra, sempre con il testo
    .badge {
      padding: 0.0625rem 0.5rem;
      border: 1px solid var(--prio-color);
      border-radius: 1rem;
      background: color-mix(in srgb, var(--prio-color) 14%, transparent);
      color: var(--prio-color);
      font: var(--mat-sys-label-medium);
      font-weight: 700;
    }

    .web {
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      font: var(--mat-sys-label-medium);

      mat-icon {
        width: 1rem;
        height: 1rem;
        font-size: 1rem;
      }
    }

    .reasons {
      margin: 0;
      padding-inline-start: 1.125rem;
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class TechnologyPriorityList {
  readonly items = input.required<readonly EntityRow[]>();
  readonly emptyText = input('Niente da segnalare.');
  readonly canEdit = input(false);

  readonly open = output<EntityRow>();

  protected readonly count = computed(() => this.items().length);

  protected systems(item: EntityRow): string {
    const names = (item['systemNames'] as readonly string[] | undefined) ?? [];
    return names.length > 0 ? names.join(', ') : 'nessun sistema indicato';
  }

  protected reasons(item: EntityRow): readonly string[] {
    return (item['reasons'] as readonly string[] | undefined) ?? [];
  }

  protected lower(value: unknown): string {
    return String(value ?? '').toLowerCase();
  }
}
