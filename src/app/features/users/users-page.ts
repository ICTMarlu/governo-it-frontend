import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';

import { PageHeader } from '../../shared/components/page-header/page-header';
import { CrudSection } from '../../shared/crud/crud-section/crud-section';
import { AuditTab } from './audit-tab';
import { PermissionsTab } from './permissions-tab';
import { ProfilesTab } from './profiles-tab';
import { USERS_CONFIG } from './users.configs';
import { USERS_HELP } from '../../shared/help/help-content';

/**
 * Utenti e permessi: l'elenco degli utenti, chi può cosa (utenti × moduli), i profili con i
 * livelli di partenza e lo storico delle modifiche. Le schede si caricano quando si aprono.
 */
@Component({
  selector: 'gov-users-page',
  imports: [AuditTab, CrudSection, MatTabsModule, PageHeader, PermissionsTab, ProfilesTab],
  template: `
    <gov-page-header
      title="Utenti e permessi"
      subtitle="Accessi all’applicazione e cosa può vedere o modificare ognuno."
      [help]="help"
    />
    <mat-tab-group mat-stretch-tabs="false" dynamicHeight>
      <mat-tab label="Utenti">
        <ng-template matTabContent>
          <gov-crud-section [config]="usersConfig" />
        </ng-template>
      </mat-tab>
      <mat-tab label="Permessi">
        <ng-template matTabContent><gov-permissions-tab /></ng-template>
      </mat-tab>
      <mat-tab label="Profili">
        <ng-template matTabContent><gov-profiles-tab /></ng-template>
      </mat-tab>
      <mat-tab label="Storico">
        <ng-template matTabContent><gov-audit-tab /></ng-template>
      </mat-tab>
    </mat-tab-group>
  `,
})
export class UsersPage {
  protected readonly usersConfig = USERS_CONFIG;
  protected readonly help = USERS_HELP;
}
