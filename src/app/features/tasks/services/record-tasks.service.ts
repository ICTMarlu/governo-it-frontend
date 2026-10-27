import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, from, map, switchMap } from 'rxjs';

import { RecordTaskCount, RecordTasksPort } from '../../../shared/crud/record-tasks';
import { TasksService } from './tasks.service';

/**
 * Task dei record degli elenchi (D-36), per la tabella condivisa (token RECORD_TASKS). È registrato
 * all'avvio, quindi il pannello si carica solo al primo clic: niente peso in più all'apertura.
 */
@Injectable({ providedIn: 'root' })
export class RecordTasksService implements RecordTasksPort {
  private readonly service = inject(TasksService);
  private readonly dialog = inject(MatDialog);

  counts(type: string): Observable<ReadonlyMap<string, RecordTaskCount>> {
    return this.service
      .sourceCounts(type)
      .pipe(
        map(
          (rows) =>
            new Map(rows.map((row) => [row.sourceId, { open: row.open, total: row.total }])),
        ),
      );
  }

  open(type: string, id: string, label: string): Observable<boolean> {
    return from(import('../components/record-tasks-panel/record-tasks-panel')).pipe(
      switchMap(({ RecordTasksPanel }) =>
        this.dialog
          .open(RecordTasksPanel, {
            data: { type, id, label },
            width: '480px',
            maxWidth: '100vw',
            height: '100%',
            position: { top: '0', right: '0' },
            panelClass: 'side-panel',
            autoFocus: false,
          })
          .afterClosed(),
      ),
      map((changed) => changed === true),
    );
  }
}
