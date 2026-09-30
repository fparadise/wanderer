import type { FeatureCollection } from 'geojson';
import type { GpxWorkerRequest, GpxWorkerResponse } from '$lib/workers/gpx_parser.worker';

export interface ParseGpxOptions {
    includeRoute?: boolean;
    includeWaypoints?: boolean;
}

export class GpxWorkerService {
    private worker: Worker | null = null;
    private pending = new Map<string, { resolve: (fc: FeatureCollection) => void; reject: (err: Error) => void }>();
    private cache = new Map<string, FeatureCollection>();

    private getWorker(): Worker | null {
        if (typeof window === 'undefined' || typeof Worker === 'undefined') {
            return null;
        }

        if (!this.worker) {
            try {
                this.worker = new Worker(
                    new URL('../workers/gpx_parser.worker.ts', import.meta.url),
                    { type: 'module' }
                );

                this.worker.onmessage = (event: MessageEvent<GpxWorkerResponse>) => {
                    const { id, geojson, error } = event.data;
                    const pendingRequest = this.pending.get(id);
                    if (!pendingRequest) {
                        return;
                    }
                    this.pending.delete(id);

                    if (error) {
                        pendingRequest.reject(new Error(error));
                    } else if (geojson) {
                        this.cache.set(id, geojson);
                        pendingRequest.resolve(geojson);
                    } else {
                        pendingRequest.reject(new Error('Empty worker response'));
                    }
                };

                this.worker.onerror = (err) => {
                    console.error('GPX Worker error:', err);
                };
            } catch (err) {
                console.warn('Failed to initialize GPX Worker, using fallback', err);
                return null;
            }
        }

        return this.worker;
    }

    public async parseGpxToGeoJSON(
        id: string,
        gpxData: string,
        options?: ParseGpxOptions
    ): Promise<FeatureCollection> {
        if (this.cache.has(id)) {
            return this.cache.get(id)!;
        }

        const worker = this.getWorker();

        if (!worker) {
            const { default: GPX } = await import('$lib/models/gpx/gpx');
            const gpx = GPX.parse(gpxData);
            const geojson = gpx.toGeoJSON(options?.includeRoute, options?.includeWaypoints);
            this.cache.set(id, geojson);
            return geojson;
        }

        return new Promise<FeatureCollection>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            worker.postMessage({
                id,
                gpxData,
                includeRoute: options?.includeRoute,
                includeWaypoints: options?.includeWaypoints
            } as GpxWorkerRequest);
        });
    }

    public getCached(id: string): FeatureCollection | undefined {
        return this.cache.get(id);
    }

    public setCache(id: string, geojson: FeatureCollection): void {
        this.cache.set(id, geojson);
    }

    public clearCache(id?: string): void {
        if (id) {
            this.cache.delete(id);
        } else {
            this.cache.clear();
        }
    }
}

export const gpxWorkerService = new GpxWorkerService();
