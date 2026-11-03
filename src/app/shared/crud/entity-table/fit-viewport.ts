import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** Spazio lasciato sotto la tabella, in pixel. */
const BOTTOM_GAP = 12;
/** Altezza minima della tabella anche su schermi bassi, in pixel. */
const MIN_HEIGHT = 240;

/**
 * Limita l'altezza dell'elemento a quella che resta nella finestra sotto di lui, così la barra di scorrimento
 * orizzontale della tabella si vede subito in fondo allo schermo, senza scendere in fondo alla pagina: con
 * molte righe scorrono dentro la tabella (l'intestazione resta ferma). Si ricalcola quando la pagina cambia
 * dimensione (finestra ridimensionata, filtri che vanno a capo, righe che cambiano).
 */
@Directive({ selector: '[govFitViewport]' })
export class FitViewport {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const fit = () => this.fit();
      fit();
      const observer = new ResizeObserver(fit);
      observer.observe(document.body);
      window.addEventListener('resize', fit);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        window.removeEventListener('resize', fit);
      });
    });
  }

  private fit(): void {
    const element = this.host.nativeElement;
    // Nascosto (es. su smartphone ci sono le schede): niente da limitare
    if (element.offsetParent === null) {
      return;
    }
    const top = element.getBoundingClientRect().top + window.scrollY;
    const available = window.innerHeight - top - BOTTOM_GAP;
    element.style.maxHeight = `${Math.max(available, MIN_HEIGHT)}px`;
  }
}
