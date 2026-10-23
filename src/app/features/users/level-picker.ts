import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AccessLevel, LEVELS, LEVEL_ICONS, LEVEL_LABELS } from '../../core/auth/permissions';

/**
 * Scelta del livello di un modulo: Nascosto, Vista, Modifica. Con {@code allowInherit} c'è
 * anche "Come il profilo" (nessuna eccezione). I colori sono sempre accompagnati da icona e
 * testo: grigio nascosto, azzurro vista, verde modifica.
 */
@Component({
  selector: 'gov-level-picker',
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <div class="picker" role="radiogroup" [attr.aria-label]="label()">
      @if (allowInherit()) {
        <button
          type="button"
          role="radio"
          class="opt opt--inherit"
          [class.opt--on]="value() === null"
          [attr.aria-checked]="value() === null"
          [disabled]="disabled()"
          [matTooltip]="'Come il profilo: ' + inheritLabel()"
          (click)="pick(null)"
        >
          <mat-icon aria-hidden="true">sync_alt</mat-icon>
          @if (!compact()) {
            Profilo{{ inheritLabel() ? ' · ' + inheritLabel() : '' }}
          }
        </button>
      }
      @for (level of levels; track level) {
        <button
          type="button"
          role="radio"
          class="opt opt--{{ level }}"
          [class.opt--on]="value() === level"
          [attr.aria-checked]="value() === level"
          [disabled]="disabled()"
          [matTooltip]="labels[level]"
          (click)="pick(level)"
        >
          <mat-icon aria-hidden="true">{{ icons[level] }}</mat-icon>
          @if (!compact()) {
            {{ labels[level] }}
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      --lv-none: light-dark(#5f6672, #9aa1ad);
      --lv-view: light-dark(#2a78d6, #5ba0f0);
      --lv-edit: light-dark(#2e7d32, #7cc683);
      --lv-inherit: var(--mat-sys-on-surface-variant);
      display: inline-block;
    }

    .picker {
      display: inline-flex;
      overflow: hidden;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 1rem;
    }

    .opt {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.625rem;
      border: 0;
      border-inline-end: 1px solid var(--mat-sys-outline-variant);
      background: transparent;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
      white-space: nowrap;
      cursor: pointer;

      &:last-child {
        border-inline-end: 0;
      }

      mat-icon {
        width: 1.125rem;
        height: 1.125rem;
        font-size: 1.125rem;
      }

      &:hover:not(:disabled) {
        background: var(--mat-sys-surface-container);
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: -2px;
      }
    }

    .opt--on {
      font-weight: 700;
    }

    .opt--inherit.opt--on {
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
    }

    .opt--NONE.opt--on {
      background: color-mix(in srgb, var(--lv-none) 18%, transparent);
      color: var(--lv-none);
    }

    .opt--VIEW.opt--on {
      background: color-mix(in srgb, var(--lv-view) 18%, transparent);
      color: var(--lv-view);
    }

    .opt--EDIT.opt--on {
      background: color-mix(in srgb, var(--lv-edit) 18%, transparent);
      color: var(--lv-edit);
    }
  `,
})
export class LevelPicker {
  /** Livello scelto; null = "come il profilo" (solo con allowInherit). */
  readonly value = input.required<AccessLevel | null>();
  readonly label = input('Livello di accesso');
  readonly allowInherit = input(false);
  /** Livello del profilo, mostrato accanto a "Profilo" (es. "Vista"). */
  readonly inheritLabel = input('');
  readonly compact = input(false);
  readonly disabled = input(false);

  readonly valueChange = output<AccessLevel | null>();

  protected readonly levels = LEVELS;
  protected readonly labels = LEVEL_LABELS;
  protected readonly icons = LEVEL_ICONS;

  protected pick(level: AccessLevel | null): void {
    if (level !== this.value()) {
      this.valueChange.emit(level);
    }
  }
}
