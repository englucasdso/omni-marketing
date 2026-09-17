import { Artifact } from '../types';
import type {
  ContentSearchResult,
  ParameterCriterion,
  ParameterSearchResult,
  AdvancedParameterSearchResponse,
} from '../workers/artifactSearch.worker';

class SearchWorkerClient {
  private worker: Worker | null = null;
  private isIndexReady = false;
  private pendingCallbacks = new Map<number, (data: any) => void>();
  private currentQueryId = 0;
  private initPromise: Promise<void> | null = null;
  private initResolve: (() => void) | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      this.worker = new Worker(
        new URL('../workers/artifactSearch.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent) => {
        const { type, queryId, results, total, durationMs, suggestions, response, error } = event.data || {};

        if (type === 'INDEX_READY') {
          this.isIndexReady = true;
          if (this.initResolve) {
            this.initResolve();
            this.initResolve = null;
          }
          return;
        }

        if (queryId !== undefined && this.pendingCallbacks.has(queryId)) {
          const cb = this.pendingCallbacks.get(queryId);
          this.pendingCallbacks.delete(queryId);
          if (cb) {
            if (error) {
              cb({ error });
            } else if (type === 'SEARCH_CODE_AND_PARAMETERS_RESULT') {
              cb({ response });
            } else if (type === 'PARAMETER_SUGGESTIONS_RESULT') {
              cb({ suggestions });
            } else {
              cb({ results, total, durationMs });
            }
          }
        }
      };

      this.worker.onerror = (err) => {
        console.error('[SearchWorkerClient] Worker error:', err);
      };
    } catch (e) {
      console.warn('[SearchWorkerClient] Failed to instantiate worker:', e);
    }
  }

  public get ready(): boolean {
    return this.isIndexReady;
  }

  public initIndex(artifacts: Artifact[]): Promise<void> {
    if (!this.worker) return Promise.resolve();

    if (this.initPromise && !this.isIndexReady) {
      return this.initPromise;
    }

    this.isIndexReady = false;
    this.initPromise = new Promise<void>((resolve) => {
      this.initResolve = resolve;
      this.worker?.postMessage({
        type: 'INIT_INDEX',
        payload: { artifacts },
      });
    });

    return this.initPromise;
  }

  public searchContent(
    query: string,
    limit = 500
  ): Promise<{ results: ContentSearchResult[]; total: number; durationMs: number }> {
    if (!this.worker) {
      return Promise.resolve({ results: [], total: 0, durationMs: 0 });
    }

    const queryId = ++this.currentQueryId;

    return new Promise((resolve, reject) => {
      this.pendingCallbacks.set(queryId, (res: any) => {
        if (res?.error) reject(new Error(res.error));
        else resolve({ results: res.results || [], total: res.total || 0, durationMs: res.durationMs || 0 });
      });

      this.worker?.postMessage({
        type: 'SEARCH_CONTENT',
        queryId,
        payload: { query, limit },
      });
    });
  }

  public searchCodeAndParameters(
    rawQuery: string,
    options?: {
      matchType?: 'auto' | 'literal' | 'normalized' | 'params';
      scope?: 'SNIPPET' | 'SCREEN';
      condition?: 'AND' | 'OR';
      limit?: number;
    }
  ): Promise<AdvancedParameterSearchResponse> {
    if (!this.worker) {
      return Promise.resolve({
        completeGroups: [],
        partialGroups: [],
        allArtifactIds: [],
        totalArtifactsCount: 0,
        queryKind: 'parameter',
        extractedParams: [],
        durationMs: 0,
      });
    }

    const queryId = ++this.currentQueryId;

    return new Promise((resolve, reject) => {
      this.pendingCallbacks.set(queryId, (res: any) => {
        if (res?.error) reject(new Error(res.error));
        else resolve(res.response);
      });

      this.worker?.postMessage({
        type: 'SEARCH_CODE_AND_PARAMETERS',
        queryId,
        payload: { rawQuery, options },
      });
    });
  }

  public searchParameters(
    criteria: ParameterCriterion[],
    combination: 'AND' | 'OR' = 'AND',
    scope: 'SNIPPET' | 'SCREEN' = 'SNIPPET',
    limit = 500
  ): Promise<{ results: ParameterSearchResult[]; total: number; durationMs: number }> {
    if (!this.worker) {
      return Promise.resolve({ results: [], total: 0, durationMs: 0 });
    }

    const queryId = ++this.currentQueryId;

    return new Promise((resolve, reject) => {
      this.pendingCallbacks.set(queryId, (res: any) => {
        if (res?.error) reject(new Error(res.error));
        else resolve({ results: res.results || [], total: res.total || 0, durationMs: res.durationMs || 0 });
      });

      this.worker?.postMessage({
        type: 'SEARCH_PARAMETERS',
        queryId,
        payload: { criteria, combination, scope, limit },
      });
    });
  }

  public getParameterSuggestions(field: string, input: string, limit = 10): Promise<string[]> {
    if (!this.worker) return Promise.resolve([]);

    const queryId = ++this.currentQueryId;

    return new Promise((resolve) => {
      this.pendingCallbacks.set(queryId, (res: any) => {
        resolve(res.suggestions || []);
      });

      this.worker?.postMessage({
        type: 'GET_PARAMETER_SUGGESTIONS',
        queryId,
        payload: { field, input, limit },
      });
    });
  }
}

export const searchWorkerClient = new SearchWorkerClient();

