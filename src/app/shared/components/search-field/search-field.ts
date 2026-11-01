import { Component, ElementRef, input, model, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Casella di ricerca dal vivo, uguale in tutte le pagine (stile .inline-search in styles.scss):
 * alta come bottoni e filtri, ✕ per svuotare, Esc per azzerare. Larga quanto serve al testo
 * d'esempio (width) o quanto decide il contenitore.
 */
@Component({
  selector: 'gov-search-field',
  imports: [MatIconModule],
  host: {
    class: 'inline-search',
    '[style.--gi-search-w]': 'width()',
    '(click)': 'focus()',
  },
  template: `
    <mat-icon aria-hidden="true">search</mat-icon>
    <input
      #box
      type="search"
      class="inline-search__input"
      autocomplete="off"
      [placeholder]="placeholder()"
      [attr.aria-label]="label() ?? placeholder()"
      [value]="value()"
      (input)="value.set(box.value)"
      (keydown.escape)="clear($event)"
    />
    @if (value()) {
      <button
        type="button"
        class="inline-search__clear"
        aria-label="Svuota la ricerca"
        title="Svuota la ricerca"
        (click)="clear($event)"
      >
        <mat-icon aria-hidden="true">close</mat-icon>
      </button>
    }
  `,
})
export class SearchField {
  /** Testo cercato (two-way: [(value)]="search"). */
  readonly value = model('');
  readonly placeholder = input('Cerca');
  /** Nome per gli screen reader, se diverso dal testo d'esempio. */
  readonly label = input<string>();
  /** Larghezza (es. '24rem'); senza, quella di base o quella data dal contenitore. */
  readonly width = input<string>();

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  protected focus(): void {
    this.box().nativeElement.focus();
  }

  protected clear(event: Event): void {
    if (!this.value()) {
      return;
    }
    event.stopPropagation();
    this.value.set('');
    this.focus();
  }
}
