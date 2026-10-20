import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

/** Collegamento per tornare alla pagina superiore (componente di presentazione). */
export interface BackLinkTarget {
  readonly link: string;
  readonly label: string;
}

@Component({
  selector: 'gov-back-link',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <a mat-button class="back" [routerLink]="target().link">
      <mat-icon aria-hidden="true">arrow_back</mat-icon>
      {{ target().label }}
    </a>
  `,
  styles: `
    .back {
      margin-block-end: 0.5rem;
      margin-inline-start: -0.75rem;
    }
  `,
})
export class BackLink {
  readonly target = input.required<BackLinkTarget>();
}
