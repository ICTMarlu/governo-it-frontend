import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import { ActualWeek } from './actuals.model';

/** Ore consuntivate di una riga del piano in una settimana (colonna Actual del piano). */
export interface PlanActual {
  readonly planRowId: number;
  readonly weekStart: string;
  readonly hours: number;
}

/** Chiamate del consuntivo delle ore (D-37). */
@Injectable({ providedIn: 'root' })
export class ActualsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/plan`;

  /** Senza persona: quella dell'utente collegato (l'Admin può sceglierne un'altra). */
  week(weekStart: string, resourceId?: number | null): Observable<ActualWeek> {
    const params: Record<string, string> = { weekStart };
    if (resourceId) {
      params['resourceId'] = String(resourceId);
    }
    return this.http.get<ActualWeek>(`${this.base}/actuals/week`, { params });
  }

  save(planRowId: number, workDate: string, hours: number): Observable<ActualWeek> {
    return this.http.put<ActualWeek>(`${this.base}/actuals/entries`, {
      planRowId,
      workDate,
      hours,
    });
  }

  addRow(resourceId: number, projectId: number, weekStart: string): Observable<ActualWeek> {
    return this.http.post<ActualWeek>(`${this.base}/actuals/rows`, {
      resourceId,
      projectId,
      weekStart,
    });
  }

  confirm(resourceId: number, weekStart: string): Observable<ActualWeek> {
    return this.http.post<ActualWeek>(`${this.base}/actuals/week/confirm`, {
      resourceId,
      weekStart,
    });
  }

  reopen(resourceId: number, weekStart: string): Observable<ActualWeek> {
    return this.http.post<ActualWeek>(`${this.base}/actuals/week/reopen`, {
      resourceId,
      weekStart,
    });
  }

  /** Ore consuntivate per riga e settimana tra due date (piano settimanale). */
  planActuals(from: string, to: string): Observable<PlanActual[]> {
    return this.http.get<PlanActual[]>(`${this.base}/actuals`, { params: { from, to } });
  }
}
