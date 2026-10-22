import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { catchError, filter, interval, map, merge, of, startWith, switchMap } from 'rxjs';

import { ROLES } from '../../../shared/crud/crud.model';
import { AuthService } from '../../auth/auth.service';
import { ChangePasswordDialog } from '../../auth/change-password-dialog';
import { ThemeMode, ThemeService } from '../../theme/theme.service';
import { ReminderSummary, Task, dueLabel } from '../../../features/tasks/models/task.model';
import { TaskCommands } from '../../../features/tasks/services/task-commands.service';
import { TasksService } from '../../../features/tasks/services/tasks.service';
import { toIsoDate } from '../../../shared/dates/italian-date-adapter';

interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly route: string;
  /** Ruoli che vedono la voce; assente = tutti. */
  readonly roles?: readonly string[];
}

/** Promemoria dei task: aggiornati a ogni cambio pagina e ogni 5 minuti. */
const REMINDER_REFRESH_MS = 5 * 60 * 1000;
/** Task mostrati nel menu della campanella. */
const REMINDER_MENU_SIZE = 8;

/** Desktop da 1024px: menu laterale sempre aperto. Sotto: menu a scomparsa. */
const DESKTOP_QUERY = '(min-width: 1024px)';

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', icon: 'home', route: '/home' },
  { label: 'Progetti', icon: 'work', route: '/projects' },
  { label: 'Piano settimanale', icon: 'calendar_view_week', route: '/plan' },
  { label: 'Task', icon: 'task_alt', route: '/tasks' },
  { label: 'Ticket AMS', icon: 'support_agent', route: '/tickets' },
  { label: 'Risorse', icon: 'groups', route: '/resources' },
  { label: 'Richiedenti', icon: 'contact_mail', route: '/requesters' },
  { label: 'Direzione', icon: 'record_voice_over', route: '/management' },
  { label: 'Anagrafiche e liste', icon: 'tune', route: '/master-data' },
  { label: 'Utenti', icon: 'manage_accounts', route: '/users', roles: [ROLES.admin] },
];

/** Dati della rotta più interna (le pagine dichiarano qui `fullWidth`). */
function deepestData(snapshot: ActivatedRouteSnapshot): Record<string, unknown> {
  let route = snapshot;
  while (route.firstChild) {
    route = route.firstChild;
  }
  return route.data;
}

/**
 * Struttura dell'applicazione autenticata: barra superiore, menu di navigazione e area contenuti.
 * - Mobile/tablet: menu a scomparsa aperto dal pulsante, si chiude dopo la scelta.
 * - Desktop (da 1024px): menu nella barra blu, così il contenuto ha tutta la larghezza.
 * - Pagine a tutta larghezza (`data: { fullWidth: true }`, es. il piano settimanale): il
 *   contenuto non ha la larghezza massima delle altre pagine.
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
    MatBadgeModule,
    MatButtonModule,
    MatMenuModule,
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
  protected readonly theme = inject(ThemeService);
  private readonly tasksService = inject(TasksService);
  private readonly taskCommands = inject(TaskCommands);

  protected readonly themeOptions: readonly { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Chiaro', icon: 'light_mode' },
    { mode: 'dark', label: 'Scuro', icon: 'dark_mode' },
    { mode: 'system', label: 'Come il sistema', icon: 'contrast' },
  ];
  protected readonly themeLabel = computed(
    () => this.themeOptions.find((option) => option.mode === this.theme.mode())!.label,
  );

  protected readonly currentUser = this.authService.currentUser;
  protected readonly isDesktop = toSignal(
    inject(BreakpointObserver)
      .observe(DESKTOP_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  /** La pagina corrente usa tutta la larghezza dello schermo. */
  protected readonly fullWidthPage = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => deepestData(this.router.routerState.snapshot.root)['fullWidth'] === true),
    ),
    { initialValue: false },
  );

  /** Promemoria dell'utente (campanella): task in ritardo, in scadenza o col promemoria arrivato. */
  protected readonly reminders = toSignal(
    merge(
      this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
      interval(REMINDER_REFRESH_MS),
    ).pipe(
      startWith(null),
      switchMap(() =>
        this.tasksService.reminders().pipe(catchError(() => of<ReminderSummary | null>(null))),
      ),
    ),
    { initialValue: null },
  );
  protected readonly reminderCount = computed(() => this.reminders()?.tasks.length ?? 0);
  protected readonly reminderTasks = computed(
    () => this.reminders()?.tasks.slice(0, REMINDER_MENU_SIZE) ?? [],
  );
  protected readonly reminderLabel = computed(() => {
    const summary = this.reminders();
    if (!summary || summary.tasks.length === 0) {
      return 'Promemoria: nessun task da seguire';
    }
    return `Promemoria: ${summary.overdue} in ritardo, ${summary.dueSoon} in scadenza`;
  });

  /** Voci di menu visibili al ruolo dell'utente. */
  protected readonly navItems = computed(() => {
    const role = this.currentUser()?.role;
    return NAV_ITEMS.filter(
      (item) => !item.roles || (role !== undefined && item.roles.includes(role)),
    );
  });

  protected reminderDue(task: Task): string {
    return dueLabel(task, toIsoDate(new Date())) || (task.remindOn ? 'promemoria' : '');
  }

  protected openReminder(task: Task): void {
    this.taskCommands.openDetail(task.id).subscribe();
  }

  protected onNavigate(sidenav: MatSidenav): void {
    void sidenav.close();
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
