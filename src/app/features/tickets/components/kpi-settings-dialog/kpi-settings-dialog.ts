import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { errorMessage } from '../../../../shared/crud/crud-api.service';
import { KPI_GROUPS, KpiGroup, KpiSettingsService } from '../../services/kpi-settings.service';

/** Scelta dei KPI da mostrare nelle pagine dei ticket: spunta = visibile. */
@Component({
  selector: 'gov-kpi-settings-dialog',
  imports: [MatButtonModule, MatCheckboxModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Personalizza i KPI</h2>
    <mat-dialog-content>
      <p class="intro">
        Togli la spunta ai KPI che non ti servono: spariscono solo per te e puoi riattivarli quando
        vuoi.
      </p>
      @for (group of groups; track group.title) {
        <fieldset class="group">
          <legend class="group__title">
            <mat-checkbox
              [checked]="allShown(group)"
              [indeterminate]="someShown(group) && !allShown(group)"
              (change)="toggleGroup(group, $event.checked)"
            >
              {{ group.title }}
            </mat-checkbox>
          </legend>
          @for (item of group.items; track item.id) {
            <mat-checkbox
              class="group__item"
              [checked]="!hidden().has(item.id)"
              (change)="toggle(item.id, $event.checked)"
            >
              {{ item.label }}
            </mat-checkbox>
          }
        </fieldset>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [disabled]="hidden().size === 0" (click)="showAll()">
        Mostra tutti
      </button>
      <button mat-button type="button" mat-dialog-close>Annulla</button>
      <button mat-flat-button type="button" [disabled]="saving()" (click)="save()">Salva</button>
    </mat-dialog-actions>
  `,
  styles: `
    .intro {
      margin-top: 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .group {
      display: flex;
      flex-direction: column;
      margin: 0 0 0.75rem;
      padding: 0 0 0.25rem;
      border: 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);

      &__title {
        padding: 0;
        font-weight: 500;
      }

      &__item {
        margin-inline-start: 1.75rem;
      }
    }
  `,
})
export class KpiSettingsDialog {
  private readonly settings = inject(KpiSettingsService);
  private readonly dialogRef = inject(MatDialogRef<KpiSettingsDialog>);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly groups = KPI_GROUPS;
  protected readonly hidden = signal<ReadonlySet<string>>(new Set(this.settings.hidden()));
  protected readonly saving = signal(false);

  protected allShown(group: KpiGroup): boolean {
    return group.items.every((item) => !this.hidden().has(item.id));
  }

  protected someShown(group: KpiGroup): boolean {
    return group.items.some((item) => !this.hidden().has(item.id));
  }

  protected toggle(id: string, shown: boolean): void {
    this.hidden.update((current) => {
      const next = new Set(current);
      if (shown) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected toggleGroup(group: KpiGroup, shown: boolean): void {
    group.items.forEach((item) => this.toggle(item.id, shown));
  }

  protected showAll(): void {
    this.hidden.set(new Set());
  }

  protected save(): void {
    this.saving.set(true);
    this.settings.save(this.hidden()).subscribe({
      next: () => this.dialogRef.close(true),
      error: (e) => {
        this.saving.set(false);
        this.snackBar.open(errorMessage(e), 'Chiudi');
      },
    });
  }
}
