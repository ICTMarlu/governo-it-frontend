import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import { ProjectStatus } from '../models/project-status.model';

@Injectable({ providedIn: 'root' })
export class ProjectStatusService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/project-statuses`;

  findAll(): Observable<ProjectStatus[]> {
    return this.http.get<ProjectStatus[]>(this.url);
  }
}
