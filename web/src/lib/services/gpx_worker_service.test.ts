import { describe, it, expect, beforeEach } from 'vitest';
import { GpxWorkerService } from './gpx_worker_service';

const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="wanderer" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Sample Track</name>
    <trkseg>
      <trkpt lat="46.0" lon="7.0">
        <ele>1000</ele>
      </trkpt>
      <trkpt lat="46.1" lon="7.1">
        <ele>1200</ele>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('GpxWorkerService', () => {
    let service: GpxWorkerService;

    beforeEach(() => {
        service = new GpxWorkerService();
    });

    it('parses GPX to GeoJSON via fallback in Node environment', async () => {
        const geojson = await service.parseGpxToGeoJSON('trail-1', sampleGpx);
        expect(geojson.type).toBe('FeatureCollection');
        expect(geojson.features.length).toBeGreaterThan(0);
        const line = geojson.features[0];
        expect(line.geometry.type).toBe('LineString');
        expect((line.geometry as any).coordinates).toEqual([
            [7.0, 46.0, "1000"],
            [7.1, 46.1, "1200"]
        ]);
    });

    it('caches the parsed GeoJSON for subsequent calls', async () => {
        const res1 = await service.parseGpxToGeoJSON('trail-1', sampleGpx);
        const cached = service.getCached('trail-1');
        expect(cached).toBe(res1);

        const res2 = await service.parseGpxToGeoJSON('trail-1', sampleGpx);
        expect(res2).toBe(res1);
    });

    it('clears cache on demand', async () => {
        await service.parseGpxToGeoJSON('trail-1', sampleGpx);
        expect(service.getCached('trail-1')).toBeDefined();

        service.clearCache('trail-1');
        expect(service.getCached('trail-1')).toBeUndefined();
    });

    it('rejects on invalid GPX data', async () => {
        await expect(service.parseGpxToGeoJSON('bad-trail', '<invalid')).rejects.toThrow();
    });
});
