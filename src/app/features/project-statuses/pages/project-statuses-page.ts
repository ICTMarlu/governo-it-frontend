import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, map, of, startWith } from 'rxjs';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ProjectStatusList } from '../components/project-status-list/project-status-list';
import { ProjectStatus } from '../models/project-status.model';
import { ProjectStatusService } from '../services/project-status.service';

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly items: readonly ProjectStatus[] }
  | { readonly status: 'error' };

/** Pagina stati progetto (smart component): carica i dati e li passa al componente di presentazione. */
@Component({
  selector: 'gov-project-statuses-page',
  imports: [PageHeader, ProjectStatusList, MatProgressSpinnerModule],
  template: `
    <gov-page-header
      title="Stati progetto"
      subtitle="Ciclo di vita dei progetti. Gli stati finali sono esclusi dal carico futuro."
    />

    @switch (state().status) {
      @case ('loading') {
        <div class="state" role="status">
          <mat-progress-spinner diameter="32" mode="indeterminate" aria-hidden="true" />
          <span>Caricamento…</span>
        </div>
      }
      @case ('error') {
        <p class="state state--error" role="alert">
          Impossibile caricare gli stati. Verifica che il backend sia avviato.
        </p>
      }
      @case ('ready') {
        <gov-project-status-list [statuses]="items()" />
      }
    }
  `,
  styles: `
    .state {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .state--error {
      padding: 0.75rem;
      border-radius: 0.25rem;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class ProjectStatusesPage {
  protected readonly state = toSignal(
    inject(ProjectStatusService)
      .findAll()
      .pipe(
        map((items): ViewState => ({ status: 'ready', items })),
        catchError(() => of<ViewState>({ status: 'error' })),
        startWith<ViewState>({ status: 'loading' }),
      ),
    { requireSync: true },
  );

  protected items(): readonly ProjectStatus[] {
    const current = this.state();
    return current.status === 'ready' ? current.items : [];
  }
}
