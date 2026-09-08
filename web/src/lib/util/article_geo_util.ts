import type { Article } from "$lib/models/article";
import type { Trail } from "$lib/models/trail";
import type * as M from "maplibre-gl";

export interface ArticleGeoLocation {
    lat: number;
    lon: number;
    bounds?: [[number, number], [number, number]]; // [[minLon, minLat], [maxLon, maxLat]]
}

/**
 * Extracts representative starting coordinates and global bounds for an article.
 * Looks at expanded relations (linked trails).
 */
export function getArticleGeoLocation(article: Article): ArticleGeoLocation | null {
    const rawTrails = (article.expand?.relation || []) as Trail[];
    if (!rawTrails || rawTrails.length === 0) {
        return null;
    }

    // Preserve the author's defined stage order from article.relation
    const relationIds = Array.isArray(article.relation) ? article.relation : [];
    const orderedTrails = relationIds.length > 0
        ? relationIds
              .map((id) => rawTrails.find((t) => t.id === id))
              .filter((t): t is Trail => !!t && t.lat != null && t.lon != null && (t.lat !== 0 || t.lon !== 0))
        : rawTrails.filter((t) => t.lat != null && t.lon != null && (t.lat !== 0 || t.lon !== 0));

    if (orderedTrails.length === 0) {
        return null;
    }

    // Starting point is the start of the first stage
    const firstTrail = orderedTrails[0];
    const startLat = firstTrail.lat!;
    const startLon = firstTrail.lon!;

    const validTrails = orderedTrails;

    // Calculate global bounds for all stages in this article
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;

    for (const t of validTrails) {
        const anyT = t as any;
        const lat = t.lat!;
        const lon = t.lon!;

        const tMinLat = typeof anyT.min_lat === "number" && anyT.min_lat !== 0 ? anyT.min_lat : lat;
        const tMaxLat = typeof anyT.max_lat === "number" && anyT.max_lat !== 0 ? anyT.max_lat : lat;
        const tMinLon = typeof anyT.min_lon === "number" && anyT.min_lon !== 0 ? anyT.min_lon : lon;
        const tMaxLon = typeof anyT.max_lon === "number" && anyT.max_lon !== 0 ? anyT.max_lon : lon;

        minLat = Math.min(minLat, tMinLat);
        maxLat = Math.max(maxLat, tMaxLat);
        minLon = Math.min(minLon, tMinLon);
        maxLon = Math.max(maxLon, tMaxLon);
    }

    const hasValidBounds =
        minLat !== Infinity &&
        maxLat !== -Infinity &&
        minLon !== Infinity &&
        maxLon !== -Infinity;

    return {
        lat: startLat,
        lon: startLon,
        bounds: hasValidBounds ? [[minLon, minLat], [maxLon, maxLat]] : undefined,
    };
}

/**
 * Checks if an article's path or starting point is within the visible map bounds.
 */
export function isArticleInBounds(
    article: Article,
    bounds: M.LngLatBounds
): boolean {
    const geo = getArticleGeoLocation(article);
    if (!geo) {
        return false;
    }

    // First check if starting coordinate is in bounds
    if (bounds.contains([geo.lon, geo.lat])) {
        return true;
    }

    // If article has multi-stage bounds, check for intersection with the map viewport
    if (geo.bounds) {
        const [sw, ne] = geo.bounds;
        const [artMinLon, artMinLat] = sw;
        const [artMaxLon, artMaxLat] = ne;

        const mapWest = bounds.getWest();
        const mapEast = bounds.getEast();
        const mapSouth = bounds.getSouth();
        const mapNorth = bounds.getNorth();

        // Check bounding box overlap
        const overlapsLat = artMinLat <= mapNorth && artMaxLat >= mapSouth;
        const overlapsLon = artMinLon <= mapEast && artMaxLon >= mapWest;

        return overlapsLat && overlapsLon;
    }

    return false;
}
