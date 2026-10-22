import { Injectable, computed, signal } from '@angular/core';

/** Tema scelto dall'utente: chiaro, scuro o come il sistema operativo. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Chiave in localStorage: la legge anche lo script in index.html, prima dell'avvio, per evitare il lampo bianco. */
export const THEME_STORAGE_KEY = 'governo-it.theme';

/**
 * Tema chiaro/scuro (WCAG 2.1 AA). Il tema Material 3 usa light-dark(): basta impostare
 * `color-scheme` sulla pagina. Lo scuro usa grigi (non nero pieno) e testo attenuato (non
 * bianco pieno), con colori meno saturi, per affaticare meno la vista.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly systemDark = window.matchMedia?.('(prefers-color-scheme: dark)');

  readonly mode = signal<ThemeMode>(this.read());
  private readonly systemPrefersDark = signal(this.systemDark?.matches ?? false);

  /** Tema effettivamente mostrato. */
  readonly isDark = computed(
    () => this.mode() === 'dark' || (this.mode() === 'system' && this.systemPrefersDark()),
  );

  constructor() {
    this.systemDark?.addEventListener('change', (event) =>
      this.systemPrefersDark.set(event.matches),
    );
    this.apply(this.mode());
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Archiviazione non disponibile (es. navigazione privata): il tema vale per la sessione
    }
    this.apply(mode);
  }

  private apply(mode: ThemeMode): void {
    document.documentElement.style.colorScheme = mode === 'system' ? 'light dark' : mode;
  }

  private read(): ThemeMode {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === 'dark' || saved === 'system' ? saved : 'light';
    } catch {
      return 'light';
    }
  }
}
