import { articles_show } from '$lib/stores/article_store';
import { fetchGPX, trails_show } from '$lib/stores/trail_store';
import { parseTrackPoints, trackPointsToGeoJSON } from '$lib/util/pk_util';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
    const article = await articles_show(params.id, fetch);

    // Enrich linked trails with full details (waypoints, photos) and lightweight downsampled GeoJSON
    if (article.expand?.relation && article.expand.relation.length > 0) {
        article.expand.relation = await Promise.all(
            article.expand.relation.map(async (trailSummary: any) => {
                try {
                    const fullTrail = await trails_show(trailSummary.id, undefined, undefined, false, fetch);
                    if (fullTrail && fullTrail.gpx) {
                        try {
                            const gpxData = await fetchGPX(fullTrail, fetch);
                            if (!fullTrail.expand) fullTrail.expand = {};
                            const trackPoints = parseTrackPoints(gpxData);
                            (fullTrail.expand as any).track_points = trackPoints;
                            (fullTrail.expand as any).gpx_geojson = trackPointsToGeoJSON(trackPoints);
                        } catch (e) {
                            console.warn(`Could not load GPX for trail ${fullTrail.id}:`, e);
                        }
                    }
                    return fullTrail;
                } catch (e) {
                    console.warn(`Could not load full trail details for ${trailSummary.id}:`, e);
                    if (trailSummary && trailSummary.gpx) {
                        try {
                            const gpxData = await fetchGPX(trailSummary, fetch);
                            if (!trailSummary.expand) trailSummary.expand = {};
                            const trackPoints = parseTrackPoints(gpxData);
                            trailSummary.expand.track_points = trackPoints;
                            trailSummary.expand.gpx_geojson = trackPointsToGeoJSON(trackPoints);
                        } catch (err) {
                            console.warn(`Could not load GPX for fallback trail ${trailSummary.id}:`, err);
                        }
                    }
                    return trailSummary;
                }
            })
        );
    }

    return {
        article,
    };
};
