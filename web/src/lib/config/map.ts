import { env } from "$env/dynamic/public";

export const MAP_MAX_POLYLINES = Number(env.PUBLIC_MAP_MAX_POLYLINES || 100);

/**
 * High-contrast palette for trail tracks on maps.
 * Carefully selected to stay distinct from topo contours, vegetation,
 * water bodies, satellite imagery, and both light and dark basemaps.
 */
export const TRAIL_COLORS = [
    "#E63946", // Vivid Crimson Red
    "#2563EB", // Bright Royal Blue
    "#F59E0B", // Bright Amber
    "#8B5CF6", // Electric Violet
    "#10B981", // Vivid Emerald Green
    "#EC4899", // Hot Pink / Magenta
    "#0284C7", // Vivid Azure
    "#F97316", // Blaze Orange
    "#7C3AED", // Deep Purple
    "#0D9488", // Teal
];
