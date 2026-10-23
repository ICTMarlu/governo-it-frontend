import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { API_BASE_URL } from '../../core/config/api.config';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { HelpButton } from '../../shared/help/help-button';
import { HOME_HELP } from '../../shared/help/help-content';
import { Home, SEVERITIES, greeting, headline, isoWeek } from './home.model';

/** Come funziona Governo IT: il giro dell'app in quattro passi (guida iniziale). */
const STEPS = [
  { icon: 'work', label: 'Progetti', hint: 'cosa si fa', link: '/projects' },
  { icon: 'view_week', label: 'Piano', hint: 'chi ci lavora e quando', link: '/plan' },
  { icon: 'task_alt', label: 'Task', hint: 'cosa resta da fare', link: '/tasks' },
  { icon: 'insights', label: 'Ticket e Direzione', hint: 'come va', link: '/tickets' },
] as const;

const SHORTCUTS = [
  { icon: 'groups', label: 'Risorse', link: '/resources' },
  { icon: 'contact_mail', label: 'Richiedenti', link: '/requesters' },
  { icon: 'tune', label: 'Anagrafiche e liste', link: '/master-data' },
] as const;

/**
 * Home (D-33): il punto di oggi. Numeri flash di ticket, piano, task e direzione, le intuizioni
 * che ne nascono, le cose dell'utente e il giro dell'app. Admin e PM vedono il team, gli altri sé.
 */
@Component({
  selector: 'gov-home-page',
  imports: [DatePipe, HelpButton, MatIconModule, MatProgressSpinnerModule, RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/home`;

  protected readonly help = HOME_HELP;
  protected readonly currentUser = inject(AuthService).currentUser;
  protected readonly severities = SEVERITIES;
  protected readonly steps = STEPS;
  protected readonly shortcuts = SHORTCUTS;

  protected readonly today = new Date();
  protected readonly week = isoWeek(this.today);
  protected readonly hello = greeting(this.today);
  protected readonly firstName = computed(
    () => (this.currentUser()?.displayName ?? '').split(' ')[0] ?? '',
  );

  protected readonly home = signal<Home | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly headline = computed(() => headline(this.home()?.insights ?? []));

  constructor() {
    this.http.get<Home>(this.url).subscribe({
      next: (home) => this.home.set(home),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  protected signed(value: number): string {
    const text = value.toLocaleString('it-IT', { maximumFractionDigits: 1 });
    return value > 0 ? `+${text}` : text;
  }
}
