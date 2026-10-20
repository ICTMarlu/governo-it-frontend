import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { ROLES } from '../../../shared/crud/crud.model';
import { AuthService } from '../../auth/auth.service';
import { ChangePasswordDialog } from '../../auth/change-password-dialog';

interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly route: string;
  /** Ruoli che vedono la voce; assente = tutti. */
  readonly roles?: readonly string[];
}

/** Desktop da 1024px: menu laterale sempre aperto. Sotto: menu a scomparsa. */
const DESKTOP_QUERY = '(min-width: 1024px)';

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', icon: 'home', route: '/home' },
  { label: 'Progetti', icon: 'work', route: '/projects' },
  { label: 'Risorse', icon: 'groups', route: '/resources' },
  { label: 'Richiedenti', icon: 'contact_mail', route: '/requesters' },
  { label: 'Anagrafiche e liste', icon: 'tune', route: '/master-data' },
  { label: 'Utenti', icon: 'manage_accounts', route: '/users', roles: [ROLES.admin] },
];

/**
 * Struttura dell'applicazione autenticata: barra superiore, menu di navigazione e area contenuti.
 * - Mobile/tablet: menu a scomparsa aperto dal pulsante, si chiude dopo la scelta.
 * - Desktop: menu laterale fisso.
 */
@Component({
  selector: 'gov-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly currentUser = this.authService.currentUser;
  protected readonly isDesktop = toSignal(
    inject(BreakpointObserver)
      .observe(DESKTOP_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  /** Voci di menu visibili al ruolo dell'utente. */
  protected readonly navItems = computed(() => {
    const role = this.currentUser()?.role;
    return NAV_ITEMS.filter(
      (item) => !item.roles || (role !== undefined && item.roles.includes(role)),
    );
  });

  protected onNavigate(sidenav: MatSidenav): void {
    if (!this.isDesktop()) {
      void sidenav.close();
    }
  }

  protected changePassword(): void {
    this.dialog
      .open<ChangePasswordDialog, void, boolean>(ChangePasswordDialog, {
        width: '440px',
        maxWidth: '100vw',
      })
      .afterClosed()
      .pipe(filter((changed) => changed === true))
      .subscribe(() => this.snackBar.open('Password aggiornata', 'OK', { duration: 3000 }));
  }

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}
