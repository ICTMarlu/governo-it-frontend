import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import {
  AgendaResult,
  ManagementAction,
  ManagementTopic,
  Meeting,
} from '../models/management.model';

export interface MarkBody {
  readonly result: AgendaResult | null;
  readonly note: string | null;
  readonly postponedUntil: string | null;
  readonly decision: string | null;
}

export interface ActionBody {
  readonly topicId: number;
  readonly meetingId: number | null;
  readonly description: string;
  readonly ownerResourceId: number | null;
  readonly dueDate: string | null;
  readonly done: boolean;
  readonly version: string | null;
}

/** Chiamate della riunione con la direzione: ogni operazione restituisce la riunione aggiornata. */
@Injectable({ providedIn: 'root' })
export class MeetingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/management`;

  get(id: number): Observable<Meeting> {
    return this.http.get<Meeting>(`${this.base}/meetings/${id}`);
  }

  update(
    meeting: Meeting,
    body: { meetingDate: string; title: string | null; notes: string | null },
  ) {
    return this.http.put<Meeting>(`${this.base}/meetings/${meeting.id}`, {
      ...body,
      version: meeting.version,
    });
  }

  mark(meetingId: number, topicId: number, body: MarkBody): Observable<Meeting> {
    return this.http.put<Meeting>(`${this.base}/meetings/${meetingId}/items/${topicId}`, body);
  }

  addTopic(meetingId: number, topicId: number): Observable<Meeting> {
    return this.http.post<Meeting>(`${this.base}/meetings/${meetingId}/items`, { topicId });
  }

  removeTopic(meetingId: number, topicId: number): Observable<Meeting> {
    return this.http.delete<Meeting>(`${this.base}/meetings/${meetingId}/items/${topicId}`);
  }

  reorder(meetingId: number, topicIds: readonly number[]): Observable<Meeting> {
    return this.http.put<Meeting>(`${this.base}/meetings/${meetingId}/items/order`, { topicIds });
  }

  close(meetingId: number): Observable<Meeting> {
    return this.http.post<Meeting>(`${this.base}/meetings/${meetingId}/close`, {});
  }

  reopen(meetingId: number): Observable<Meeting> {
    return this.http.post<Meeting>(`${this.base}/meetings/${meetingId}/reopen`, {});
  }

  openTopics(): Observable<ManagementTopic[]> {
    return this.http.get<ManagementTopic[]>(`${this.base}/topics`);
  }

  createAction(body: ActionBody): Observable<ManagementAction> {
    return this.http.post<ManagementAction>(`${this.base}/actions`, body);
  }

  updateAction(action: ManagementAction, done: boolean): Observable<ManagementAction> {
    return this.http.put<ManagementAction>(`${this.base}/actions/${action.id}`, {
      topicId: action.topicId,
      meetingId: action.meetingId,
      description: action.description,
      ownerResourceId: action.ownerResourceId,
      dueDate: action.dueDate,
      done,
      version: action.version,
    });
  }
}
