import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import { Ticket, TicketDashboard, TicketFilter, TicketSync } from '../models/ticket.model';

/** Chiamate della dashboard dei ticket AMS (D-24). */
@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/tickets`;

  /** Con {@code resourceId} indicatori, flussi, azioni e allerte sono quelli di una sola persona. */
  dashboard(resourceId: number | null = null): Observable<TicketDashboard> {
    const params: Record<string, number> = resourceId === null ? {} : { resourceId };
    return this.http.get<TicketDashboard>(`${this.base}/dashboard`, { params });
  }

  tickets(filter: TicketFilter | null, includeDone = false): Observable<Ticket[]> {
    const params: Record<string, string | number | boolean> = { includeDone };
    if (filter?.resourceId !== undefined) {
      params['resourceId'] = filter.resourceId;
    }
    if (filter?.unassigned) {
      params['unassigned'] = true;
    }
    if (filter?.area !== undefined) {
      params['area'] = filter.area;
    }
    if (filter?.projectId !== undefined) {
      params['projectId'] = filter.projectId;
    }
    return this.http.get<Ticket[]>(this.base, { params });
  }

  sync(full = false): Observable<TicketSync> {
    return this.http.post<TicketSync>(`${this.base}/sync`, null, { params: { full } });
  }
}
