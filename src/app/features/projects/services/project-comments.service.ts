import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import { MentionCandidate, ProjectComment } from '../models/project-comment.model';

@Injectable({ providedIn: 'root' })
export class ProjectCommentsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  findAll(projectId: number): Observable<ProjectComment[]> {
    return this.http.get<ProjectComment[]>(this.url(projectId));
  }

  create(projectId: number, body: string, parentCommentId?: number): Observable<ProjectComment> {
    return this.http.post<ProjectComment>(this.url(projectId), {
      body,
      parentCommentId: parentCommentId ?? null,
    });
  }

  update(projectId: number, comment: ProjectComment, body: string): Observable<ProjectComment> {
    return this.http.put<ProjectComment>(`${this.url(projectId)}/${comment.id}`, {
      body,
      version: comment.version,
    });
  }

  delete(projectId: number, commentId: number): Observable<void> {
    return this.http.delete<void>(`${this.url(projectId)}/${commentId}`);
  }

  /** Persone del team citabili con @ (risorse attive). */
  mentionCandidates(): Observable<MentionCandidate[]> {
    return this.http
      .get<{ id: number; fullName: string; active: boolean }[]>(`${this.apiBaseUrl}/resources`)
      .pipe(
        map((resources) =>
          resources
            .filter((resource) => resource.active)
            .map((resource) => ({ id: resource.id, name: resource.fullName }))
            .sort((a, b) => a.name.localeCompare(b.name, 'it')),
        ),
      );
  }

  private url(projectId: number): string {
    return `${this.apiBaseUrl}/projects/${projectId}/comments`;
  }
}
