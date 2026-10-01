export interface ArticleMediaItem {
    id: string;
    url: string;
    sourceTrailId: string;
    sourceTrailName: string;
    stageIndex: number;
    stageLabel: string;
    lat?: number;
    lon?: number;
    pkKm?: number;
    caption?: string;
    fileName?: string;
    timestamp?: number;
    type: "trail_photo" | "waypoint_photo" | "summit_photo" | "custom_upload";
}

/**
 * Extracts a normalized base filename from a PocketBase filename or URL.
 * PocketBase prefixes uploaded filenames with 10-16 random alphanumeric chars + underscore.
 * Examples:
 * - "a1b2c3d4e5_IMG_1234.jpg" -> "img_1234.jpg"
 * - "/api/v1/files/trails/123/a1b2c3d4e5_photo.jpeg" -> "photo.jpg"
 */
export function extractBaseFileName(fileNameOrUrl?: string): string {
    if (!fileNameOrUrl) return "";
    const raw = fileNameOrUrl.split("?")[0].split("/").pop() || "";
    let cleaned = decodeURIComponent(raw);
    // Remove PB random prefix: 10 to 16 alphanumeric characters followed by underscore
    cleaned = cleaned.replace(/^[a-zA-Z0-9]{10,16}_/, "");
    // Remove PB random suffix hash before extension if present (unless it's a route overview image)
    if (!cleaned.toLowerCase().startsWith("route_")) {
        cleaned = cleaned.replace(/_[a-zA-Z0-9]{6,16}(\.[a-zA-Z0-9]+)$/, "$1");
    }
    // Normalize .jpeg to .jpg
    cleaned = cleaned.replace(/\.jpeg$/i, ".jpg");
    return cleaned.trim().toLowerCase();
}

/**
 * Deduplicates a list of photos within a map group or activity collection.
 * Waypoint photos take priority over trail photos since they contain richer POI metadata.
 * Base-name and timestamp deduplication are strictly scoped to the same trail so that photos
 * from different stages or trails are never discarded.
 */
export function deduplicateGroupPhotos(photos: ArticleMediaItem[]): ArticleMediaItem[] {
    if (photos.length <= 1) return photos;

    const typePriority: Record<string, number> = {
        waypoint_photo: 1,
        summit_photo: 2,
        trail_photo: 3,
        custom_upload: 4,
    };

    // Sort by priority (waypoint_photo first)
    const sorted = [...photos].sort((a, b) => {
        const pA = typePriority[a.type] ?? 99;
        const pB = typePriority[b.type] ?? 99;
        return pA - pB;
    });

    const unique: ArticleMediaItem[] = [];
    const seenUrls = new Set<string>();
    const seenTrailBaseNames = new Set<string>();
    const seenTrailTimestamps = new Set<string>();

    for (const photo of sorted) {
        if (photo.url && seenUrls.has(photo.url)) {
            continue;
        }

        const baseName = extractBaseFileName(photo.fileName || photo.url);
        const nameWithoutExt = baseName.replace(/\.[^.]+$/, "");

        // Only deduplicate by base filename or timestamp within the same source trail
        const trailId = photo.sourceTrailId || "global";
        const trailBaseKey = `${trailId}:${baseName}`;
        const trailTimeKey = photo.timestamp ? `${trailId}:${photo.timestamp}` : null;

        if (nameWithoutExt.length >= 3 && seenTrailBaseNames.has(trailBaseKey)) {
            continue;
        }

        if (trailTimeKey && seenTrailTimestamps.has(trailTimeKey)) {
            continue;
        }

        unique.push(photo);
        if (photo.url) seenUrls.add(photo.url);
        if (nameWithoutExt.length >= 3) seenTrailBaseNames.add(trailBaseKey);
        if (trailTimeKey) seenTrailTimestamps.add(trailTimeKey);
    }

    return unique;
}

