import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../core/config/api.config';

/** Prodotto del catalogo endoflife.date (es. PHP, Windows Server). */
export interface CatalogProduct {
  readonly name: string;
  readonly label: string;
  readonly category: string | null;
  /** Categoria dell'inventario più adatta (es. RUNTIME per PHP). */
  readonly suggestedCategory: string;
}

/** Una versione del prodotto con la sua fine supporto. */
export interface CatalogRelease {
  readonly cycle: string;
  readonly label: string | null;
  readonly releaseDate: string | null;
  readonly supportEnd: string | null;
  readonly ended: boolean;
  readonly maintained: boolean;
  readonly latest: string | null;
  readonly latestLink: string | null;
}

export interface CatalogProductDetail extends CatalogProduct {
  readonly cpe: string | null;
  readonly releases: readonly CatalogRelease[];
}

export interface CheckResult {
  readonly checked: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly notFound: number;
  readonly failed: number;
  readonly notes: readonly string[];
}

/** Catalogo guidato e controllo della fine supporto: il backend interroga endoflife.date. */
@Injectable({ providedIn: 'root' })
export class TechnologyCatalogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/technologies`;

  search(query: string): Observable<CatalogProduct[]> {
    return this.http.get<CatalogProduct[]>(`${this.base}/catalog`, { params: { q: query } });
  }

  product(name: string): Observable<CatalogProductDetail> {
    return this.http.get<CatalogProductDetail>(`${this.base}/catalog/${encodeURIComponent(name)}`);
  }

  /** Controlla ora la fine supporto delle tecnologie che hanno l'identificativo del prodotto. */
  check(): Observable<CheckResult> {
    return this.http.post<CheckResult>(`${this.base}/check`, {});
  }
}
