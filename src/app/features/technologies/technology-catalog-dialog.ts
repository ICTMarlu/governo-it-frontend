import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap } from 'rxjs';

import { CrudApiService, errorMessage } from '../../shared/crud/crud-api.service';
import { EntityRow } from '../../shared/crud/crud.model';
import { CATEGORIES, CRITICALITIES, EXPOSURES } from './technologies.configs';
import {
  CatalogProduct,
  CatalogProductDetail,
  CatalogRelease,
  TechnologyCatalogService,
} from './technology-catalog.service';

/**
 * Aggiunta guidata: si cerca il prodotto nel catalogo (endoflife.date), si sceglie la versione e
 * nome, identificativo, fine supporto, ultima versione e CPE si compilano da soli. Restano da
 * indicare esposizione, criticità e a quali sistemi serve.
 */
@Component({
  selector: 'gov-technology-catalog-dialog',
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Aggiungi dal catalogo</h2>
    <mat-dialog-content class="content">
      <p class="intro">
        Cerca il prodotto e scegli la versione: la data di fine supporto la prende dal catalogo
        pubblico endoflife.date. Al catalogo arriva solo il nome del prodotto.
      </p>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Prodotto</mat-label>
        <input
          matInput
          autocomplete="off"
          placeholder="Scrivi per cercare: php, windows server, wordpress, mysql…"
          [formControl]="query"
          [matAutocomplete]="auto"
        />
        @if (searching()) {
          <mat-progress-spinner matSuffix diameter="18" mode="indeterminate" />
        } @else {
          <mat-icon matSuffix aria-hidden="true">search</mat-icon>
        }
        <mat-autocomplete
          #auto="matAutocomplete"
          [displayWith]="productLabel"
          (optionSelected)="pick($event.option.value)"
        >
          @for (product of results(); track product.name) {
            <mat-option [value]="product">
              {{ product.label }} <span class="muted">· {{ product.name }}</span>
            </mat-option>
          }
        </mat-autocomplete>
        @if (noResults()) {
          <mat-hint
            >Nessun prodotto trovato: puoi aggiungerla a mano con “Nuova tecnologia”.</mat-hint
          >
        }
      </mat-form-field>

      @if (loadingProduct()) {
        <p class="state" role="status">
          <mat-progress-spinner diameter="20" mode="indeterminate" aria-hidden="true" /> Carico le
          versioni…
        </p>
      }

      @if (detail(); as product) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Versione in uso</mat-label>
          <mat-select [value]="cycle()" (valueChange)="cycle.set($event)">
            @for (release of product.releases; track release.cycle) {
              <mat-option [value]="release.cycle">
                {{ release.cycle }} · {{ supportText(release) }}
              </mat-option>
            }
          </mat-select>
          <mat-hint
            >Scegli la versione principale (es. 8.1): il numero esatto lo puoi precisare
            poi.</mat-hint
          >
        </mat-form-field>

        @if (release(); as chosen) {
          <div class="release" [class.release--ended]="chosen.ended">
            <mat-icon aria-hidden="true">{{ chosen.ended ? 'warning' : 'verified' }}</mat-icon>
            <span>
              <strong>{{ supportText(chosen) }}</strong>
              @if (chosen.latest) {
                · ultima versione {{ chosen.latest }}
              }
            </span>
          </div>
        }

        <div class="grid">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Categoria</mat-label>
            <mat-select [value]="category()" (valueChange)="category.set($event)">
              @for (option of categories; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Esposizione</mat-label>
            <mat-select [value]="exposure()" (valueChange)="exposure.set($event)">
              @for (option of exposures; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
            <mat-hint>Siti e servizi pubblici: esposta a internet</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Criticità per il business</mat-label>
            <mat-select [value]="criticality()" (valueChange)="criticality.set($event)">
              @for (option of criticalities; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Sistemi che la usano</mat-label>
            <mat-select multiple [value]="systemIds()" (valueChange)="systemIds.set($event)">
              @for (system of systems(); track system.value) {
                <mat-option [value]="system.value">{{ system.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Server / ambienti</mat-label>
          <input
            matInput
            maxlength="300"
            placeholder="Es. SRV-WEB01 (produzione)"
            [value]="hosts()"
            (input)="hosts.set($any($event.target).value)"
          />
        </mat-form-field>
      }

      @if (error(); as message) {
        <p class="error" role="alert">{{ message }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Annulla</button>
      <button mat-flat-button type="button" [disabled]="!canSave() || saving()" (click)="save()">
        @if (saving()) {
          <mat-progress-spinner diameter="18" mode="indeterminate" aria-hidden="true" />
        }
        Aggiungi
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      min-width: min(40rem, 92vw);
    }

    .intro,
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }

    .intro {
      margin: 0;
      font: var(--mat-sys-body-small);
    }

    .grid {
      display: grid;
      gap: 0.875rem;
      grid-template-columns: 1fr;
    }

    @media (min-width: 600px) {
      .grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    .release {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      background: color-mix(in srgb, #2e7d32 12%, transparent);

      &--ended {
        background: color-mix(in srgb, #c62828 12%, transparent);
      }
    }

    .state {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .error {
      margin: 0;
      padding: 0.75rem;
      border-radius: 0.25rem;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class TechnologyCatalogDialog {
  private readonly catalog = inject(TechnologyCatalogService);
  private readonly api = inject(CrudApiService);
  private readonly dialogRef =
    inject<MatDialogRef<TechnologyCatalogDialog, EntityRow>>(MatDialogRef);

  protected readonly categories = CATEGORIES;
  protected readonly exposures = EXPOSURES;
  protected readonly criticalities = CRITICALITIES;

  protected readonly query = new FormControl<string | CatalogProduct>('', { nonNullable: true });
  protected readonly results = signal<readonly CatalogProduct[]>([]);
  protected readonly searching = signal(false);
  protected readonly noResults = signal(false);

  protected readonly detail = signal<CatalogProductDetail | null>(null);
  protected readonly loadingProduct = signal(false);
  protected readonly cycle = signal<string | null>(null);
  protected readonly category = signal('APPLICATION');
  protected readonly exposure = signal('INTERNAL');
  protected readonly criticality = signal('MEDIUM');
  protected readonly systemIds = signal<readonly number[]>([]);
  protected readonly hosts = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly systems = toSignal(this.api.options({ endpoint: '/lookups/main-systems' }), {
    initialValue: [],
  });

  protected readonly release = computed<CatalogRelease | null>(
    () => this.detail()?.releases.find((release) => release.cycle === this.cycle()) ?? null,
  );
  protected readonly canSave = computed(() => this.detail() !== null && this.release() !== null);

  constructor() {
    // Ricerca mentre si scrive, senza una richiesta per ogni lettera
    this.query.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => {
          if (typeof value !== 'string' || value.trim().length < 2) {
            this.results.set([]);
            this.noResults.set(false);
            return of(null);
          }
          this.searching.set(true);
          return this.catalog.search(value.trim()).pipe(
            catchError((failure: unknown) => {
              this.error.set(errorMessage(failure));
              return of(null);
            }),
            finalize(() => this.searching.set(false)),
          );
        }),
      )
      .subscribe((found) => {
        if (found) {
          this.error.set(null);
          this.results.set(found);
          this.noResults.set(found.length === 0);
        }
      });
  }

  protected productLabel(product: CatalogProduct | string | null): string {
    return typeof product === 'string' ? product : (product?.label ?? '');
  }

  protected pick(product: CatalogProduct): void {
    this.detail.set(null);
    this.cycle.set(null);
    this.loadingProduct.set(true);
    this.error.set(null);
    this.category.set(product.suggestedCategory);
    this.catalog
      .product(product.name)
      .pipe(finalize(() => this.loadingProduct.set(false)))
      .subscribe({
        next: (detail) => this.detail.set(detail),
        error: (failure: unknown) => this.error.set(errorMessage(failure)),
      });
  }

  protected supportText(release: CatalogRelease): string {
    if (!release.supportEnd) {
      return release.ended ? 'fuori supporto' : 'nessuna data di fine supporto';
    }
    const day = new Date(release.supportEnd).toLocaleDateString('it-IT');
    return release.ended ? `fuori supporto dal ${day}` : `supportata fino al ${day}`;
  }

  protected save(): void {
    const detail = this.detail();
    const release = this.release();
    if (!detail || !release) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api
      .create('/technologies', {
        name: detail.label,
        category: this.category(),
        softwareVersion: release.cycle,
        systemIds: [...this.systemIds()],
        hosts: this.hosts().trim() || null,
        businessCriticality: this.criticality(),
        exposure: this.exposure(),
        supportEndDate: release.supportEnd,
        latestVersion: release.latest,
        ownerResourceId: null,
        vendorId: null,
        eolProduct: detail.name,
        cpe: detail.cpe,
        notes: null,
        active: true,
        version: null,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (created) => this.dialogRef.close(created),
        error: (failure: unknown) => this.error.set(errorMessage(failure)),
      });
  }
}
