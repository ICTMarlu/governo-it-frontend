import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, map, of, switchMap, take } from 'rxjs';

import { errorMessage } from '../../../shared/crud/crud-api.service';
import {
  TaskDetailData,
  TaskDetailDialog,
} from '../components/task-detail-dialog/task-detail-dialog';
import { Task, doneStatus, firstOpenStatus } from '../models/task.model';
import { TasksService } from './tasks.service';

/** Azioni comuni a pannello della casella, pagina Task e campanella. */
@Injectable({ providedIn: 'root' })
export class TaskCommands {
  private readonly service = inject(TasksService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Spunta: un task aperto passa a "fatto", uno chiuso torna al primo stato aperto. */
  toggleDone(task: Task): Observable<Task | null> {
    return this.service.statuses$.pipe(
      take(1),
      map((statuses) => (task.done ? firstOpenStatus(statuses) : doneStatus(statuses))),
      switchMap((status) => (status ? this.changeStatus(task, status.id) : of(null))),
    );
  }

  /** Cambio di stato; in caso di errore avvisa e restituisce null. */
  changeStatus(task: Task, statusId: number): Observable<Task | null> {
    return new Observable<Task | null>((subscriber) => {
      const subscription = this.service.changeStatus(task, statusId).subscribe({
        next: (updated) => {
          subscriber.next(updated);
          subscriber.complete();
        },
        error: (error: unknown) => {
          this.snackBar.open(errorMessage(error), 'OK', { duration: 6000 });
          subscriber.next(null);
          subscriber.complete();
        },
      });
      return () => subscription.unsubscribe();
    });
  }

  /** Apre il dettaglio; emette true se il task è stato modificato o eliminato. */
  openDetail(taskId: number): Observable<boolean> {
    return this.dialog
      .open<TaskDetailDialog, TaskDetailData, boolean>(TaskDetailDialog, {
        data: { taskId },
        width: '920px',
        maxWidth: '100vw',
        maxHeight: '100vh',
        autoFocus: 'first-heading',
      })
      .afterClosed()
      .pipe(map((changed) => changed === true));
  }
}
