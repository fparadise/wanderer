import GPX from "$lib/models/gpx/gpx";
import { haversineDistance } from "$lib/models/gpx/utils";

export interface TrackPointWithDistance {
    lat: number;
    lon: number;
    ele?: number;
    time?: number; // timestamp in ms
    distanceKm: number;
}

export function trackPointsToGeoJSON(points: TrackPointWithDistance[]): any {
    if (!points || points.length === 0) {
        return {
            type: "FeatureCollection",
            features: []
        };
    }

    const coordinates = points.map((p) => [p.lon, p.lat, p.ele ?? 0]);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of coordinates) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }

    return {
        type: "FeatureCollection",
        bbox: [minX, minY, maxX, maxY],
        features: [
            {
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates,
                },
                properties: {},
            },
        ],
    };
}

export function parseTrackPoints(gpxSource: string | GPX | null | undefined): TrackPointWithDistance[] {
    if (!gpxSource) return [];
    try {
        const rawPoints: { lat: number; lon: number; ele?: number; time?: number }[] = [];

        if (typeof gpxSource === "string") {
            // Fast regex parser: handles <trkpt lat="..." lon="..."> and <trkpt lon="..." lat="...">
            const trkptRegex = /<trkpt\s+([^>]+)>(?:([\s\S]*?)<\/trkpt>)?/gi;
            let match: RegExpExecArray | null;

            while ((match = trkptRegex.exec(gpxSource)) !== null) {
                const attrs = match[1];
                const inner = match[2];

                const latMatch = attrs.match(/lat=["']([^"']+)["']/i);
                const lonMatch = attrs.match(/lon=["']([^"']+)["']/i);

                if (latMatch && lonMatch) {
                    const lat = parseFloat(latMatch[1]);
                    const lon = parseFloat(lonMatch[1]);
                    if (!isNaN(lat) && !isNaN(lon)) {
                        let ele: number | undefined;
                        let time: number | undefined;
                        if (inner) {
                            const eleMatch = inner.match(/<ele>([^<]+)<\/ele>/i);
                            if (eleMatch) {
                                const parsedEle = parseFloat(eleMatch[1]);
                                if (!isNaN(parsedEle)) ele = parsedEle;
                            }
                            const timeMatch = inner.match(/<time>([^<]+)<\/time>/i);
                            if (timeMatch) {
                                const parsedTime = new Date(timeMatch[1]).getTime();
                                if (!isNaN(parsedTime)) time = parsedTime;
                            }
                        }
                        rawPoints.push({ lat, lon, ele, time });
                    }
                }
            }
        } else {
            // If already a parsed GPX object
            for (const track of gpxSource.trk || []) {
                for (const seg of track.trkseg || []) {
                    for (const pt of seg.trkpt || []) {
                        const lat = pt.$?.lat;
                        const lon = pt.$?.lon;
                        if (lat !== undefined && lon !== undefined) {
                            let time: number | undefined;
                            if (pt.time) {
                                const parsedTime = new Date(pt.time).getTime();
                                if (!isNaN(parsedTime)) time = parsedTime;
                            }
                            rawPoints.push({ lat, lon, ele: pt.ele, time });
                        }
                    }
                }
            }
        }

        if (rawPoints.length === 0) return [];

        // Downsample to max 1,500 points to ensure UI responsiveness and fast calculations
        const MAX_POINTS = 1500;
        const stride = Math.max(1, Math.floor(rawPoints.length / MAX_POINTS));

        const result: TrackPointWithDistance[] = [];
        let cumDistM = 0;
        let prevPoint: { lat: number; lon: number } | null = null;

        for (let i = 0; i < rawPoints.length; i++) {
            const pt = rawPoints[i];
            if (prevPoint) {
                cumDistM += haversineDistance(prevPoint.lat, prevPoint.lon, pt.lat, pt.lon);
            }
            prevPoint = pt;

            // Retain first, last, and every `stride` points
            if (i === 0 || i === rawPoints.length - 1 || i % stride === 0) {
                result.push({
                    lat: pt.lat,
                    lon: pt.lon,
                    ele: pt.ele,
                    time: pt.time,
                    distanceKm: Math.round((cumDistM / 1000) * 100) / 100,
                });
            }
        }

        return result;
    } catch (e) {
        console.warn("Failed to parse GPX for PK:", e);
        return [];
    }
}

export function parseExifDate(dateStr: string): number | null {
    if (!dateStr || typeof dateStr !== "string") return null;
    const match = dateStr.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const hour = parseInt(match[4], 10);
        const min = parseInt(match[5], 10);
        const sec = parseInt(match[6], 10);
        const d = new Date(year, month, day, hour, min, sec);
        return isNaN(d.getTime()) ? null : d.getTime();
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.getTime();
}

export function convertDMStoDecimal(dms: any, direction: string = "N"): number {
    if (!Array.isArray(dms) || dms.length < 3) return 0;
    const deg = Number(dms[0]) || 0;
    const min = Number(dms[1]) || 0;
    const sec = Number(dms[2]) || 0;
    let dd = deg + min / 60 + sec / 3600;
    const dir = (direction || "").toUpperCase();
    if (dir === "S" || dir === "W" || dir === "O") {
        dd = -dd;
    }
    return dd;
}

export function findPointForTimestamp(
    points: TrackPointWithDistance[],
    timestampMs: number,
    maxDiffMinutes: number = 90
): { lat: number; lon: number; km: number } | null {
    if (!points || points.length === 0) return null;
    let closestPoint: TrackPointWithDistance | null = null;
    let minDiff = Infinity;

    for (const pt of points) {
        if (pt.time !== undefined) {
            const diff = Math.abs(pt.time - timestampMs);
            if (diff < minDiff) {
                minDiff = diff;
                closestPoint = pt;
            }
        }
    }

    if (closestPoint && minDiff <= maxDiffMinutes * 60 * 1000) {
        return {
            lat: closestPoint.lat,
            lon: closestPoint.lon,
            km: closestPoint.distanceKm,
        };
    }
    return null;
}

export function getCoordinateAtKm(
    points: TrackPointWithDistance[],
    targetKm: number
): TrackPointWithDistance | null {
    if (!points || points.length === 0) return null;
    if (targetKm <= points[0].distanceKm) return points[0];
    if (targetKm >= points[points.length - 1].distanceKm) return points[points.length - 1];

    // Binary search since distanceKm is monotonically increasing
    let low = 0;
    let high = points.length - 1;

    while (low <= high) {
        const mid = (low + high) >> 1;
        if (points[mid].distanceKm < targetKm) {
            low = mid + 1;
        } else if (points[mid].distanceKm > targetKm) {
            high = mid - 1;
        } else {
            return points[mid];
        }
    }

    const p1 = points[Math.max(0, high)];
    const p2 = points[Math.min(points.length - 1, low)];
    return Math.abs(p1.distanceKm - targetKm) <= Math.abs(p2.distanceKm - targetKm) ? p1 : p2;
}

export function findKmForCoordinate(
    points: TrackPointWithDistance[],
    lat: number,
    lon: number,
    maxDistanceM: number = 2000
): { km: number; distanceToTrackM: number; point: TrackPointWithDistance } | null {
    if (!points || points.length === 0) return null;

    let closestPoint = points[0];
    let minDistanceM = haversineDistance(lat, lon, points[0].lat, points[0].lon);

    // Degrees bounding box filter (~111km per deg lat)
    const degThreshold = (maxDistanceM * 1.5) / 111000;

    for (let i = 1; i < points.length; i++) {
        const pt = points[i];
        if (Math.abs(pt.lat - lat) > degThreshold || Math.abs(pt.lon - lon) > degThreshold) {
            continue;
        }
        const d = haversineDistance(lat, lon, pt.lat, pt.lon);
        if (d < minDistanceM) {
            minDistanceM = d;
            closestPoint = pt;
        }
    }

    if (minDistanceM > maxDistanceM) {
        return null;
    }

    return {
        km: closestPoint.distanceKm,
        distanceToTrackM: Math.round(minDistanceM),
        point: closestPoint,
    };
}

export function extractQuoteFromHtml(html: string, targetIdOrText: string): string {
    if (!html) return "";
    try {
        // Strip out tags except looking around target
        const temp = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
        const parser = new DOMParser();
        const doc = parser.parseFromString(temp, "text/html");

        // Find element with data-pk or matching text
        const elements = Array.from(doc.querySelectorAll(".pk-badge, [data-km]"));
        for (const el of elements) {
            if (el.textContent?.includes(targetIdOrText) || el.getAttribute("data-km") === targetIdOrText) {
                const parent = el.closest("p, li, blockquote, div") || el;
                return (parent.textContent || "").trim();
            }
        }

        // Fallback: search raw text
        const plain = doc.body.textContent || "";
        const idx = plain.indexOf(targetIdOrText);
        if (idx !== -1) {
            const start = Math.max(0, idx - 60);
            const end = Math.min(plain.length, idx + targetIdOrText.length + 80);
            return (start > 0 ? "..." : "") + plain.substring(start, end).trim() + (end < plain.length ? "..." : "");
        }
    } catch {
        // SSR fallback
    }
    return "";
}
