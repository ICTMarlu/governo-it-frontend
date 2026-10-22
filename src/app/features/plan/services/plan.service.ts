import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import { CellsResult, Plan, PlanRow } from '../models/plan.model';

export interface RowBody {
  readonly resourceId: number;
  readonly projectId: number;
  readonly rowNote: string | null;
  readonly archived: boolean;
  readonly version: string | null;
}

/** Chiamate del piano settimanale: lettura della griglia e salvataggio cella per cella. */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/plan`;

  load(from: string, weeks: number, archived: boolean): Observable<Plan> {
    return this.http.get<Plan>(this.base, { params: { from, weeks, archived } });
  }

  saveCell(
    row: PlanRow,
    weekStart: string,
    days: number,
    note: string | null,
  ): Observable<CellsResult> {
    return this.http.put<CellsResult>(`${this.base}/cells`, {
      rowId: row.id,
      resourceId: row.resourceId,
      weekStart,
      days,
      note,
    });
  }

  fill(row: PlanRow, fromWeek: string, toWeek: string, days: number): Observable<CellsResult> {
    return this.http.post<CellsResult>(`${this.base}/fill`, {
      rowId: row.id,
      resourceId: row.resourceId,
      fromWeek,
      toWeek,
      days,
    });
  }

  createRow(body: RowBody): Observable<PlanRow> {
    return this.http.post<PlanRow>(`${this.base}/rows`, body);
  }

  updateRow(id: number, body: RowBody): Observable<PlanRow> {
    return this.http.put<PlanRow>(`${this.base}/rows/${id}`, body);
  }

  deleteRow(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/rows/${id}`);
  }
}
