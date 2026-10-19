import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../../auth/auth.service';

interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly route: string;
}

/** Desktop da 1024px: menu laterale sempre aperto. Sotto: menu a scomparsa. */
const DESKTOP_QUERY = '(min-width: 1024px)';

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

  protected readonly currentUser = this.authService.currentUser;
  protected readonly isDesktop = toSignal(
    inject(BreakpointObserver)
      .observe(DESKTOP_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly navItems: readonly NavItem[] = [
    { label: 'Home', icon: 'home', route: '/home' },
    { label: 'Progetti', icon: 'work', route: '/projects' },
    { label: 'Risorse', icon: 'groups', route: '/resources' },
    { label: 'Richiedenti', icon: 'contact_mail', route: '/requesters' },
    { label: 'Anagrafiche e liste', icon: 'tune', route: '/master-data' },
  ];

  protected onNavigate(sidenav: MatSidenav): void {
    if (!this.isDesktop()) {
      void sidenav.close();
    }
  }

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}
