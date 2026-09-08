/**
 * Wanderer Design System Tokens & Conventions
 *
 * This module documents and standardizes UI tokens across Wanderer:
 * - Theme colors (mapping to CSS variables in theme.css & app.css)
 * - Border radii hierarchy
 * - Elevation & shadows
 * - Consistent formatting helpers for articles and trails
 */

/**
 * Standard border radii across Wanderer components.
 * Follow this hierarchy to keep UI shapes harmonious.
 */
export const RADIUS = {
    /** Banners, hero cards, full-width highlights */
    hero: "rounded-3xl",
    /** Trail cards, article cards, large containers, modals */
    card: "rounded-2xl",
    /** Inputs, dropdowns, primary/secondary buttons */
    input: "rounded-lg",
    /** Compact badges, inner controls */
    control: "rounded-md",
    /** Badges, pills, chips, circular avatars */
    pill: "rounded-full",
} as const;

/**
 * Standard card styles following Wanderer's native design tokens.
 * Adapts seamlessly to both light & dark themes.
 */
export const CARD_STYLES = {
    base: "bg-background border border-input-border text-content transition-all",
    interactive: "bg-background border border-input-border text-content hover:border-primary/60 transition-all cursor-pointer",
    subtle: "bg-input-background border border-input-border text-content",
} as const;

/**
 * Typography classes for editorial magazine & core wanderer UI.
 */
export const TYPOGRAPHY = {
    /** Serif titles for magazine articles and long-form editorial headers */
    serifHeading: "font-serif font-extrabold tracking-tight text-content",
    serifSubheading: "font-serif font-bold text-content",
    serifIntro: "font-serif italic text-content/80 leading-relaxed",
    /** Primary sans-serif font (IBMPlexSans) */
    sansHeading: "font-sans font-bold text-content",
    sansLabel: "text-xs font-bold uppercase tracking-wider text-content/70",
    sansMuted: "text-sm text-content/70",
    sansCaption: "text-xs text-content/60",
} as const;

/**
 * Format days count into human-readable label.
 */
export function formatDays(days?: number): string {
    if (!days || days <= 0) return "";
    return `${days} ${days > 1 ? "jours" : "jour"}`;
}

/**
 * Format article technical metadata into a concise summary badge string.
 * e.g., "142 km · +3 200 m · 4 jours"
 */
export function formatArticleSummary(article: {
    total_distance?: number;
    total_elevation_gain?: number;
    total_days?: number;
}): string[] {
    const parts: string[] = [];

    if (article.total_distance && article.total_distance > 0) {
        parts.push(`${article.total_distance} km`);
    }
    if (article.total_elevation_gain && article.total_elevation_gain > 0) {
        parts.push(`+${article.total_elevation_gain} m`);
    }
    if (article.total_days && article.total_days > 0) {
        parts.push(formatDays(article.total_days));
    }

    return parts;
}

/**
 * Standard tokens for editorial / magazine elements across Wanderer.
 */
export const EDITORIAL_TOKENS = {
    /** Primary theme accent for story badges, highlights and icons */
    accent: "rgba(var(--primary))",
    /** Hover state for theme accents */
    accentHover: "rgba(var(--primary-hover))",
    /** Soft translucent background for badges */
    accentBackground: "rgba(var(--primary), 0.12)",
    /** Border tint for primary cards / chips */
    accentBorder: "rgba(var(--primary), 0.3)",
    /** Pill badge styling for editorial markers */
    badge: "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary text-white shadow-xs",
    badgeOutline: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25",
} as const;

/**
 * Super Pin map marker design tokens ensuring strict adherence to the design system.
 */
export const SUPER_PIN_TOKENS = {
    pillRadius: RADIUS.pill,
    cardRadius: RADIUS.card,
    controlRadius: RADIUS.control,
    maxTitleWidth: "185px",
    maxPillWidth: "290px",
    thumbSize: "32px",
    pointerWidth: 16, // px (8px left + 8px right border)
    pointerHeight: 10, // px
    accentColor: "rgba(var(--primary))",
    accentHoverColor: "rgba(var(--primary-hover))",
} as const;
