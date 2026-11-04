import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { LAYERS } from './architecture.configs';
import { AppLink, AppNode, LAYER_COLORS, criticalityColor } from './architecture.model';

/** Applicativo raggiunto seguendo i flussi, con il numero di passaggi. */
export interface ReachedApp {
  readonly app: AppNode;
  readonly steps: number;
}

/**
 * Scheda a destra della mappa (D-38): con un applicativo scelto, i suoi dati, cosa si ferma se
 * si ferma, da cosa dipende e i suoi flussi; senza, la legenda e i più collegati.
 */
@Component({
  selector: 'gov-architecture-map-panel',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (app(); as app) {
      <header>
        <h2>{{ app.name }}</h2>
        <button mat-icon-button type="button" aria-label="Chiudi la scheda" (click)="closed.emit()">
          <mat-icon>close</mat-icon>
        </button>
      </header>
      <p class="meta">
        {{ app.typeLabel }}{{ app.systemName ? ' · ' + app.systemName : '' }} ·
        {{ app.lifecycleLabel }}
      </p>
      <dl>
        <dt>Criticità</dt>
        <dd>
          <span class="dot" [style.background]="critColor(app.businessCriticality)"></span>
          {{ app.businessCriticalityLabel }} · {{ app.exposureLabel }}
        </dd>
        <dt>Dove gira</dt>
        <dd>{{ app.deploymentLabel }}{{ app.hosts ? ' · ' + app.hosts : '' }}</dd>
        @if (app.vendorName) {
          <dt>Fornitore</dt>
          <dd>{{ app.vendorName }}</dd>
        }
        @if (app.userAreaNames.length) {
          <dt>Chi lo usa</dt>
          <dd>{{ app.userAreaNames.join(', ') }}</dd>
        }
        @if (app.ownerName || app.businessOwner) {
          <dt>Referenti</dt>
          <dd>{{ join([app.ownerName, app.businessOwner]) }}</dd>
        }
        @if (app.technologyNames.length) {
          <dt>Gira su</dt>
          <dd>{{ app.technologyNames.join(', ') }}</dd>
        }
      </dl>
      @for (warning of app.technologyWarnings; track $index) {
        <p class="alert"><mat-icon aria-hidden="true">warning</mat-icon>{{ warning }}</p>
      }

      <h3>
        Se si ferma, si fermano <span class="count">{{ impacted().length }}</span>
      </h3>
      @for (item of impacted(); track item.app.id) {
        <p class="row">
          <button type="button" class="link-btn" (click)="picked.emit(item.app.id)">
            {{ item.app.name }}
          </button>
          @if (item.steps > 1) {
            <span class="muted">indiretto · {{ item.steps }} passaggi</span>
          }
        </p>
      } @empty {
        <p class="muted">Nessun applicativo dipende da questo.</p>
      }

      <h3>
        Dipende da <span class="count">{{ upstream().length }}</span>
      </h3>
      @for (item of upstream(); track item.app.id) {
        <p class="row">
          <button type="button" class="link-btn" (click)="picked.emit(item.app.id)">
            {{ item.app.name }}
          </button>
          @if (item.steps > 1) {
            <span class="muted">indiretto · {{ item.steps }} passaggi</span>
          }
        </p>
      } @empty {
        <p class="muted">Non riceve dati da altri applicativi.</p>
      }

      <h3>
        Flussi <span class="count">{{ flows().length }}</span>
      </h3>
      @for (flow of flows(); track flow.id) {
        <p class="row">
          <strong>{{ flow.sourceName }}</strong> {{ flow.directionLabel }}
          <strong>{{ flow.targetName }}</strong>
          <span class="muted block">
            {{ join([flow.dataObjects, flow.frequencyLabel, flow.protocolLabel]) }}
          </span>
        </p>
      } @empty {
        <p class="muted">Nessuna connessione registrata.</p>
      }
      @if (editable()) {
        <button mat-stroked-button type="button" (click)="edited.emit(app.id)">
          <mat-icon aria-hidden="true">edit</mat-icon>
          Modifica applicativo
        </button>
      }
    } @else {
      <h2>Come si legge</h2>
      <p class="muted">
        Clicca un applicativo per vedere cosa si ferma se lui si ferma e da cosa dipende.
      </p>
      <h3>Livelli</h3>
      <ul class="legend">
        @for (layer of layers; track layer.value) {
          <li>
            <span class="swatch" [style.background]="layerColor(layer.value)"></span
            >{{ layer.label }}
          </li>
        }
      </ul>
      <h3>Frecce: seguono i dati</h3>
      <ul class="legend">
        <li><span class="line line--push"></span>invia a</li>
        <li><span class="line line--pull"></span>legge da</li>
        <li><span class="line line--sync"></span>sincronizza con</li>
        <li><span class="line line--thick"></span>più spessa = flusso più critico</li>
      </ul>
      <h3>Riquadri</h3>
      <ul class="legend">
        <li>
          <span class="stripe" style="background: var(--gi-critical)"></span>bordo: criticità (rosso
          critico, arancio alta, blu media)
        </li>
        <li><span class="box-dash"></span>tratteggiato: in arrivo o in dismissione</li>
        <li><span class="tri"></span>tecnologie da trattare</li>
        <li><span class="badge">3</span>connessioni dell'applicativo</li>
      </ul>
      <p class="muted">{{ totals().apps }} applicativi · {{ totals().links }} connessioni</p>
      @if (mostConnected().length) {
        <h3>I più collegati</h3>
        @for (item of mostConnected(); track item.app.id) {
          <p class="row">
            <button type="button" class="link-btn" (click)="picked.emit(item.app.id)">
              {{ item.app.name }}
            </button>
            <span class="muted">{{ item.steps }} flussi</span>
          </p>
        }
      }
    }
  `,
  styles: `
    :host {
      display: block;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--gi-radius-lg);
      padding: var(--gi-space-3);
      overflow: auto;
      background: var(--mat-sys-surface);
      font: var(--mat-sys-body-small);
    }
    header {
      display: flex;
      align-items: start;
      justify-content: space-between;
    }
    h2 {
      font: var(--mat-sys-title-medium);
      margin: 0 0 4px;
    }
    h3 {
      font: var(--mat-sys-title-small);
      margin: var(--gi-space-3) 0 4px;
    }
    .meta,
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
    .meta {
      margin: 0 0 var(--gi-space-2);
    }
    .muted {
      margin: 0 0 0 6px;
    }
    p.muted {
      margin: 4px 0;
    }
    .block {
      display: block;
      margin: 0;
    }
    .row {
      margin: 0;
      padding: 3px 0;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 10px;
      margin: 0;
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
    }
    dd {
      margin: 0;
    }
    .count {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .alert {
      display: flex;
      gap: 6px;
      align-items: center;
      color: var(--gi-warning-text);
      margin: 6px 0 0;
    }
    .alert mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .link-btn {
      border: 0;
      background: none;
      padding: 0;
      cursor: pointer;
      font: inherit;
      color: var(--mat-sys-primary);
      text-decoration: underline;
    }
    .legend {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .legend li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 2px 0;
    }
    .dot,
    .swatch {
      display: inline-block;
      flex: none;
      width: 12px;
      height: 12px;
      border-radius: 3px;
      margin-right: 4px;
    }
    .line {
      flex: none;
      width: 26px;
      border-top: 2px solid;
    }
    .line--push {
      border-color: var(--arch-push);
    }
    .line--pull {
      border-color: var(--arch-pull);
      border-top-style: dashed;
    }
    .line--sync {
      border-color: var(--mat-sys-outline);
      border-top-style: dotted;
    }
    .line--thick {
      border-top-width: 4px;
      border-color: var(--mat-sys-outline);
    }
    .stripe {
      flex: none;
      width: 5px;
      height: 16px;
      border-radius: 2px;
    }
    .box-dash {
      flex: none;
      width: 22px;
      height: 12px;
      border: 1px dashed var(--mat-sys-outline);
      border-radius: 3px;
    }
    .tri {
      flex: none;
      border-left: 7px solid transparent;
      border-right: 7px solid transparent;
      border-bottom: 12px solid var(--gi-warning);
    }
    .badge {
      flex: none;
      min-width: 20px;
      height: 20px;
      border-radius: 10px;
      display: inline-grid;
      place-items: center;
      font: var(--mat-sys-label-small);
      background: var(--mat-sys-surface-container-high);
    }
  `,
})
export class ArchitectureMapPanel {
  readonly app = input<AppNode | null>(null);
  readonly impacted = input<readonly ReachedApp[]>([]);
  readonly upstream = input<readonly ReachedApp[]>([]);
  readonly flows = input<readonly AppLink[]>([]);
  readonly editable = input(false);
  readonly totals = input({ apps: 0, links: 0 });
  /** I più collegati: in {@code steps} il numero di flussi. */
  readonly mostConnected = input<readonly ReachedApp[]>([]);

  readonly picked = output<number>();
  readonly edited = output<number>();
  readonly closed = output<void>();

  protected readonly layers = LAYERS;

  protected critColor(code: string): string {
    return criticalityColor(code);
  }

  protected layerColor(layer: unknown): string {
    return LAYER_COLORS[String(layer)] ?? 'var(--mat-sys-outline)';
  }

  protected join(parts: readonly (string | null)[]): string {
    return parts.filter(Boolean).join(' · ');
  }
}
