import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { filter, forkJoin } from 'rxjs';

import { API_BASE_URL } from '../../../../core/config/api.config';
import { CrudApiService, errorMessage } from '../../../../shared/crud/crud-api.service';
import { EntityRow } from '../../../../shared/crud/crud.model';
import {
  EntityFormDialog,
  EntityFormDialogData,
} from '../../../../shared/crud/entity-form-dialog/entity-form-dialog';
import { TOPICS_CONFIG } from '../../management.configs';
import { PostponeDialog, PostponeDialogData } from '../postpone-dialog/postpone-dialog';

/** Stato configurabile (colonna), come arriva da /lookups/management-states. */
interface State {
  readonly id: number;
  readonly label: string;
  readonly color: string | null;
  readonly sortOrder: number;
  readonly active: boolean;
  readonly behavior: string;
}

interface Topic {
  readonly id: number;
  readonly title: string;
  readonly topicTypeLabel: string;
  readonly stateId: number | null;
  readonly priorityLevel: number | null;
  readonly ownerName: string | null;
  readonly audienceNames: readonly string[];
  readonly dueDate: string | null;
  readonly overdue: boolean;
  readonly closedOn: string | null;
  readonly postponedUntil: string | null;
  readonly openActionCount: number;
  readonly version: string;
}

/** Giorni per cui un punto chiuso o annullato resta visibile nella sua colonna. */
const FINAL_VISIBLE_DAYS = 30;

/**
 * Kanban dei punti per la direzione: una colonna per ogni stato configurato (Anagrafiche ›
 * Stati della direzione). Trascinando una scheda lo stato cambia; se la colonna è di tipo
 * "posticipato" si chiede da quando riproporre il punto.
 */
@Component({
  selector: 'gov-topics-board',
  imports: [DragDropModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, RouterLink],
  template: `
    @if (error(); as message) {
      <p class="state state--error" role="alert">{{ message }}</p>
    } @else if (!topics()) {
      <p class="state" role="status">
        <mat-progress-spinner diameter="20" mode="indeterminate" aria-hidden="true" /> Caricamento…
      </p>
    } @else {
      <p class="hint">
        @if (canWrite()) {
          Trascina i punti da una colonna all’altra per cambiare stato; clicca il titolo per
          aprirli.
        } @else {
          Clicca il titolo per aprire il punto.
        }
        Chiusi e annullati restano {{ finalDays }} giorni.
        @if (canConfigure()) {
          <a routerLink="/master-data/lookups/management-states">Gestisci le colonne</a>
        }
      </p>
      <div class="board" cdkDropListGroup>
        @for (column of columns(); track column.state.id) {
          <section
            class="column"
            cdkDropList
            [cdkDropListData]="column.state"
            [style.--status-color]="column.state.color"
            [attr.aria-labelledby]="'topic-column-' + column.state.id"
            (cdkDropListDropped)="drop($event)"
          >
            <h2 class="column__title" [id]="'topic-column-' + column.state.id">
              {{ column.state.label }} <span class="count">{{ column.topics.length }}</span>
            </h2>
            @for (topic of column.topics; track topic.id) {
              <div class="card" cdkDrag [cdkDragData]="topic" [cdkDragDisabled]="!canWrite()">
                <button type="button" class="card__title" (click)="open(topic)">
                  {{ topic.title }}
                </button>
                <div class="card__meta">
                  <span class="chip">{{ topic.topicTypeLabel }}</span>
                  @if (topic.priorityLevel !== null) {
                    <span class="chip" title="Priorità">P{{ topic.priorityLevel }}</span>
                  }
                  @if (topic.openActionCount > 0) {
                    <span class="chip" title="Azioni aperte">
                      <mat-icon aria-hidden="true">checklist</mat-icon>{{ topic.openActionCount }}
                    </span>
                  }
                </div>
                @if (topic.audienceNames.length > 0) {
                  <div class="card__line">
                    <mat-icon aria-hidden="true">person</mat-icon>
                    {{ topic.audienceNames.join(', ') }}
                  </div>
                }
                @if (topic.ownerName) {
                  <div class="card__line">
                    <mat-icon aria-hidden="true">engineering</mat-icon>{{ topic.ownerName }}
                  </div>
                }
                @if (topic.dueDate) {
                  <div class="card__line" [class.late]="topic.overdue">
                    <mat-icon aria-hidden="true">event</mat-icon>
                    {{ day(topic.dueDate) }}{{ topic.overdue ? ' · scaduto' : '' }}
                  </div>
                }
                @if (topic.postponedUntil) {
                  <div class="card__line">
                    <mat-icon aria-hidden="true">schedule</mat-icon>
                    Dal {{ day(topic.postponedUntil) }}
                  </div>
                }
              </div>
            } @empty {
              <p class="empty">Nessun punto</p>
            }
          </section>
        }
      </div>
    }
  `,
  styles: `
    .hint {
      margin: 0 0 0.75rem;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .state {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--mat-sys-on-surface-variant);

      &--error {
        color: var(--mat-sys-error);
      }
    }

    .board {
      display: flex;
      gap: 0.75rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
    }

    .column {
      flex: 0 0 17rem;
      min-height: 8rem;
      padding: 0.5rem;
      border-top: 4px solid var(--status-color, var(--mat-sys-outline));
      border-radius: 0.5rem;
      background: var(--mat-sys-surface-container-low);

      &__title {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        margin: 0 0 0.5rem;
        font: var(--mat-sys-title-small);
      }
    }

    .count {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }

    .card {
      margin-bottom: 0.5rem;
      padding: 0.5rem 0.625rem;
      border-radius: 0.5rem;
      background: var(--mat-sys-surface);
      box-shadow: var(--mat-sys-level1);
      cursor: grab;

      &__title {
        display: block;
        margin: 0 0 0.25rem;
        padding: 0;
        border: 0;
        background: none;
        color: var(--mat-sys-primary);
        font: var(--mat-sys-label-large);
        text-align: left;
        cursor: pointer;
      }

      &__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin-bottom: 0.25rem;
      }

      &__line {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);

        mat-icon {
          width: 1rem;
          height: 1rem;
          font-size: 1rem;
        }
      }
    }

    .chip {
      display: inline-flex;
      align-items: center;
      padding: 0 0.5rem;
      border-radius: 1rem;
      background: var(--mat-sys-surface-container-high);
      font: var(--mat-sys-label-small);

      mat-icon {
        width: 0.875rem;
        height: 0.875rem;
        font-size: 0.875rem;
      }
    }

    .late {
      color: var(--mat-sys-error);
    }

    .empty {
      margin: 0.5rem 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .cdk-drag-preview {
      box-shadow: var(--mat-sys-level3);
    }

    @media (min-width: 1024px) {
      .column {
        flex: 1 1 0;
        min-width: 14rem;
      }
    }
  `,
})
export class TopicsBoard {
  private readonly api = inject(CrudApiService);
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Cambia per far ricaricare i punti dopo un inserimento veloce. */
  readonly refresh = input(0);
  readonly canWrite = input(false);
  /** Solo l'Admin configura le colonne (Anagrafiche). */
  readonly canConfigure = input(false);

  protected readonly finalDays = FINAL_VISIBLE_DAYS;
  protected readonly topics = signal<readonly Topic[] | null>(null);
  protected readonly states = signal<readonly State[]>([]);
  protected readonly error = signal<string | null>(null);

  protected readonly columns = computed(() => {
    const limit = new Date();
    limit.setDate(limit.getDate() - FINAL_VISIBLE_DAYS);
    const isRecent = (topic: Topic, state: State): boolean =>
      !['CLOSED', 'CANCELLED'].includes(state.behavior) ||
      topic.closedOn === null ||
      new Date(`${topic.closedOn}T00:00:00`) >= limit;
    return this.states()
      .filter((state) => state.active)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((state) => ({
        state,
        topics: (this.topics() ?? []).filter(
          (topic) => topic.stateId === state.id && isRecent(topic, state),
        ),
      }));
  });

  constructor() {
    effect(() => {
      this.refresh();
      untracked(() => this.load());
    });
  }

  protected day(iso: string): string {
    return new Intl.DateTimeFormat('it-IT').format(new Date(`${iso}T00:00:00`));
  }

  protected open(topic: Topic): void {
    const row = (this.rows.get(topic.id) ?? { id: topic.id }) as EntityRow;
    const data: EntityFormDialogData = { config: TOPICS_CONFIG, row };
    const mobile = window.innerWidth < 600;
    this.dialog
      .open<EntityFormDialog, EntityFormDialogData, EntityRow>(EntityFormDialog, {
        data,
        width: mobile ? '100vw' : '720px',
        maxWidth: '100vw',
        height: mobile ? '100dvh' : undefined,
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .pipe(filter((saved): saved is EntityRow => saved !== undefined))
      .subscribe(() => {
        this.snackBar.open('Punto salvato', 'OK', { duration: 3000 });
        this.load();
      });
  }

  /** Kanban: trascinando una scheda in un'altra colonna cambia lo stato. */
  protected drop(event: CdkDragDrop<State, State, Topic>): void {
    const topic = event.item.data;
    const target = event.container.data;
    if (event.previousContainer === event.container || !this.canWrite()) {
      return;
    }
    if (target.behavior === 'POSTPONED') {
      this.dialog
        .open<PostponeDialog, PostponeDialogData, string>(PostponeDialog, {
          data: { title: topic.title },
          width: '420px',
          maxWidth: '100vw',
        })
        .afterClosed()
        .pipe(filter((date): date is string => !!date))
        .subscribe((date) => this.move(topic, target, date));
      return;
    }
    this.move(topic, target, null);
  }

  private rows = new Map<number, EntityRow>();

  private move(topic: Topic, target: State, postponedUntil: string | null): void {
    // Spostamento immediato a video, poi conferma dal server
    this.topics.update((topics) =>
      (topics ?? []).map((t) => (t.id === topic.id ? { ...t, stateId: target.id } : t)),
    );
    this.http
      .put<EntityRow>(`${this.apiBase}${TOPICS_CONFIG.endpoint}/${topic.id}/state`, {
        stateId: target.id,
        postponedUntil,
        version: topic.version,
      })
      .subscribe({
        next: () => this.load(),
        error: (error: unknown) => {
          this.snackBar.open(errorMessage(error), 'Chiudi');
          this.load();
        },
      });
  }

  private load(): void {
    forkJoin({
      topics: this.api.list(TOPICS_CONFIG.endpoint),
      states: this.api.list('/lookups/management-states'),
    }).subscribe({
      next: ({ topics, states }) => {
        this.rows = new Map(topics.map((row) => [Number(row['id']), row]));
        this.topics.set(topics as unknown as Topic[]);
        this.states.set(
          states.map((row) => ({
            ...(row as unknown as State),
            behavior: String((row['attributes'] as Record<string, unknown>)?.['behavior'] ?? ''),
          })),
        );
        this.error.set(null);
      },
      error: (error: unknown) => this.error.set(errorMessage(error)),
    });
  }
}
