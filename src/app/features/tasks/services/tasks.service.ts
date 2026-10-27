import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import { ProjectComment } from '../../projects/models/project-comment.model';
import {
  CellTaskCount,
  ReminderSummary,
  SourceTaskCount,
  Task,
  TaskBody,
  TaskDetail,
  TaskQuery,
  TaskStatusOption,
} from '../models/task.model';

interface LookupRow {
  readonly id: number;
  readonly code: string;
  readonly label: string;
  readonly color: string | null;
  readonly sortOrder: number;
  readonly active: boolean;
  readonly attributes: { readonly done?: boolean };
}

/** Chiamate dei task e delle note (D-23), con commenti e stati configurabili. */
@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly base = `${this.apiBaseUrl}/tasks`;

  /** Stati dei task in ordine; caricati una volta per sessione. */
  readonly statuses$: Observable<TaskStatusOption[]> = this.http
    .get<LookupRow[]>(`${this.apiBaseUrl}/lookups/task-statuses`)
    .pipe(
      map((rows) =>
        [...rows]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((row) => ({
            id: row.id,
            code: row.code,
            label: row.label,
            color: row.color,
            active: row.active,
            done: row.attributes.done === true,
          })),
      ),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

  search(query: TaskQuery): Observable<Task[]> {
    const params: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        params[key] = value as string | number | boolean;
      }
    }
    return this.http.get<Task[]>(this.base, { params });
  }

  detail(id: number): Observable<TaskDetail> {
    return this.http.get<TaskDetail>(`${this.base}/${id}`);
  }

  cellCounts(from: string, to: string): Observable<CellTaskCount[]> {
    return this.http.get<CellTaskCount[]>(`${this.base}/cells`, { params: { from, to } });
  }

  /** Task aperti e totali per record di un tipo (es. MOBILE_LINE), per il pallino negli elenchi. */
  sourceCounts(type: string): Observable<SourceTaskCount[]> {
    return this.http.get<SourceTaskCount[]>(`${this.base}/sources`, { params: { type } });
  }

  reminders(): Observable<ReminderSummary> {
    return this.http.get<ReminderSummary>(`${this.base}/reminders`);
  }

  create(body: TaskBody): Observable<Task> {
    return this.http.post<Task>(this.base, body);
  }

  update(id: number, body: TaskBody): Observable<Task> {
    return this.http.put<Task>(`${this.base}/${id}`, body);
  }

  changeStatus(task: Task, statusId: number): Observable<Task> {
    return this.http.put<Task>(`${this.base}/${task.id}/status`, {
      statusId,
      version: task.version,
    });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addComment(taskId: number, body: string): Observable<ProjectComment> {
    return this.http.post<ProjectComment>(`${this.base}/${taskId}/comments`, { body });
  }

  updateComment(taskId: number, comment: ProjectComment, body: string): Observable<ProjectComment> {
    return this.http.put<ProjectComment>(`${this.base}/${taskId}/comments/${comment.id}`, {
      body,
      version: comment.version,
    });
  }

  deleteComment(taskId: number, commentId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${taskId}/comments/${commentId}`);
  }
}
