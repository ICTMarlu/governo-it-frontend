import { Component, input } from '@angular/core';

import { ProjectStatus } from '../../models/project-status.model';

/**
 * Elenco degli stati (componente di presentazione: riceve i dati, non li carica).
 * - Mobile: schede impilate, leggibili senza scorrimento orizzontale.
 * - Tablet/desktop (da 768px): tabella.
 */
@Component({
  selector: 'gov-project-status-list',
  templateUrl: './project-status-list.html',
  styleUrl: './project-status-list.scss',
})
export class ProjectStatusList {
  readonly statuses = input.required<readonly ProjectStatus[]>();
}
