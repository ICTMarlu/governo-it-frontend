import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';

import { toIsoDate } from '../../../../shared/dates/italian-date-adapter';
import { TASK_SOURCES, Task, TaskStatusOption, dueLabel, weekLabel } from '../../models/task.model';

/**
 * Riga di un task nelle liste (pannello della casella, pagina Task, campanella): spunta "fatto",
 * titolo che apre il dettaglio, stato cambiabile dal menu, assegnatario, scadenza e commenti.
 */
@Component({
  selector: 'gov-task-item',
  imports: [MatButtonModule, MatCheckboxModule, MatIconModule, MatMenuModule, RouterLink],
  templateUrl: './task-item.html',
  styleUrl: './task-item.scss',
})
export class TaskItem {
  readonly task = input.required<Task>();
  readonly statuses = input<readonly TaskStatusOption[]>([]);
  readonly showProject = input(true);
  readonly showAssignee = input(true);
  /** "Da: Linea mobile …": nascosto nel pannello del record stesso. */
  readonly showSource = input(true);
  readonly busy = input(false);

  protected week(iso: string): string {
    return weekLabel(iso);
  }

  readonly opened = output<void>();
  readonly toggleDone = output<void>();
  readonly statusChange = output<number>();

  protected readonly due = computed(() => dueLabel(this.task(), toIsoDate(new Date())));
  /** Pagina del record da cui è nato il task (D-36). */
  protected readonly source = computed(() => {
    const task = this.task();
    const meta = task.sourceType ? TASK_SOURCES[task.sourceType] : undefined;
    return meta && task.sourceId ? { ...meta, ...meta.link(task.sourceId) } : null;
  });

  protected readonly activeStatuses = computed(() =>
    this.statuses().filter((status) => status.active),
  );
}
