<script lang="ts">
    import { EDITORIAL_TOKENS, RADIUS, SUPER_PIN_TOKENS, TYPOGRAPHY } from "$lib/config/design_system";
    import type { Article } from "$lib/models/article";
    import { getArticleGeoLocation } from "$lib/util/article_geo_util";
    import { getFileURL } from "$lib/util/file_util";
    import { formatDistance, formatElevation } from "$lib/util/format_util";
    import * as M from "maplibre-gl";
    import { onDestroy } from "svelte";

    interface Props {
        map?: M.Map | null;
        articles?: Article[];
        hoveredArticleId?: string | null;
        onSelectArticle?: (article: Article) => void;
    }

    let {
        map = null,
        articles = [],
        hoveredArticleId = null,
        onSelectArticle,
    }: Props = $props();

    interface ArticleMarkerEntry {
        article: Article;
        marker: M.Marker;
        element: HTMLElement;
        popup: M.Popup;
    }

    let markerEntries: Map<string, ArticleMarkerEntry> = new Map();
    let currentPopup: M.Popup | null = null;

    // React to changes in articles or map
    $effect(() => {
        if (!map) {
            clearMarkers();
            return;
        }

        syncMarkers(articles);
    });

    // React to hover changes
    $effect(() => {
        for (const [id, entry] of markerEntries) {
            if (id === hoveredArticleId) {
                entry.element.classList.add("super-pin-hovered");
                entry.element.style.zIndex = "9999";
            } else {
                entry.element.classList.remove("super-pin-hovered");
                entry.element.style.zIndex = "100";
            }
        }
    });

    onDestroy(() => {
        clearMarkers();
    });

    function clearMarkers() {
        if (currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        for (const entry of markerEntries.values()) {
            entry.marker.remove();
        }
        markerEntries.clear();
    }

    function syncMarkers(currentArticles: Article[]) {
        if (!map) return;

        const currentIds = new Set<string>();

        for (const article of currentArticles) {
            if (!article.id) continue;

            const geo = getArticleGeoLocation(article);
            if (!geo) continue;

            currentIds.add(article.id);

            if (markerEntries.has(article.id)) {
                // Update position if changed
                const existing = markerEntries.get(article.id)!;
                existing.marker.setLngLat([geo.lon, geo.lat]);
                continue;
            }

            // Create new Super Pin DOM Element
            const pinEl = document.createElement("div");
            // Root marker element: do NOT set CSS transition on transform to prevent lag
            pinEl.className = "super-pin-container group cursor-pointer select-none";
            pinEl.setAttribute("data-article-id", article.id);

            // Thumbnail or icon
            const thumbUrl = article.hero_images && article.hero_images.length > 0
                ? getFileURL(article, article.hero_images[0], "100x100")
                : null;

            const thumbHtml = thumbUrl
                ? `<img src="${thumbUrl}" alt="" class="super-pin-thumb" />`
                : `<span class="super-pin-thumb-placeholder"><i class="fa-solid fa-book-open"></i></span>`;

            // Super Pin DOM structure:
            // Top child: .super-pin-pill
            // Bottom child: .super-pin-pointer (downward triangle in normal flow, ending at the exact bottom coordinate)
            pinEl.innerHTML = `
                <div class="super-pin-pill">
                    ${thumbHtml}
                    <div class="super-pin-content">
                        <span class="super-pin-badge">
                            <i class="fa-solid fa-compass"></i> Récit
                        </span>
                        <span class="super-pin-title" title="${escapeHtml(article.title)}">
                            ${escapeHtml(article.title)}
                        </span>
                    </div>
                    <i class="fa-solid fa-chevron-right super-pin-chevron"></i>
                </div>
                <div class="super-pin-pointer"></div>
            `;

            // Build rich popup
            const popup = createRichPopup(article, thumbUrl);

            // Anchor 'bottom' ensures the tip of the downward pointer sits exactly on [geo.lon, geo.lat],
            // and the entire Super Pin pill is positioned strictly ABOVE the departure point.
            const marker = new M.Marker({
                element: pinEl,
                anchor: "bottom",
                offset: [0, 0],
            })
                .setLngLat([geo.lon, geo.lat])
                .setPopup(popup)
                .addTo(map);

            // Handle hover & click
            pinEl.addEventListener("mouseenter", () => {
                pinEl.classList.add("super-pin-hovered");
                pinEl.style.zIndex = "9999";
            });

            pinEl.addEventListener("mouseleave", () => {
                if (hoveredArticleId !== article.id) {
                    pinEl.classList.remove("super-pin-hovered");
                    pinEl.style.zIndex = "100";
                }
            });

            pinEl.addEventListener("click", (e) => {
                e.stopPropagation();
                if (currentPopup && currentPopup.isOpen()) {
                    currentPopup.remove();
                }
                currentPopup = popup;
                marker.togglePopup();
                if (onSelectArticle) {
                    onSelectArticle(article);
                }
            });

            markerEntries.set(article.id, {
                article,
                marker,
                element: pinEl,
                popup,
            });
        }

        // Remove old markers
        for (const [id, entry] of markerEntries) {
            if (!currentIds.has(id)) {
                entry.marker.remove();
                markerEntries.delete(id);
            }
        }
    }

    function createRichPopup(article: Article, thumbUrl: string | null): M.Popup {
        // Offset [0, -52] positions the popup cleanly above the Super Pin without covering it
        const popup = new M.Popup({
            maxWidth: "340px",
            offset: [0, -52],
            closeButton: true,
            closeOnClick: false,
            className: "article-super-popup",
        });

        const coverUrl = article.hero_images && article.hero_images.length > 0
            ? getFileURL(article, article.hero_images[0], "600x0")
            : null;

        const container = document.createElement("div");
        container.className = `article-popup-content flex flex-col overflow-hidden ${RADIUS.card} text-content bg-surface`;

        const statsItems: string[] = [];
        if (article.total_distance > 0) {
            statsItems.push(`
                <span class="inline-flex items-center gap-1.5 text-xs text-content/70 font-medium">
                    <i class="fa-solid fa-arrows-left-right text-primary"></i> ${formatDistance(article.total_distance)}
                </span>
            `);
        }
        if (article.total_days > 0) {
            statsItems.push(`
                <span class="inline-flex items-center gap-1.5 text-xs text-content/70 font-medium">
                    <i class="fa-solid fa-calendar-day text-primary"></i> ${article.total_days} ${article.total_days > 1 ? 'jours' : 'jour'}
                </span>
            `);
        }
        if (article.total_elevation_gain > 0) {
            statsItems.push(`
                <span class="inline-flex items-center gap-1.5 text-xs text-content/70 font-medium">
                    <i class="fa-solid fa-arrow-trend-up text-primary"></i> ${formatElevation(article.total_elevation_gain)}
                </span>
            `);
        }

        const statsHtml = statsItems.length > 0
            ? `<div class="flex flex-wrap items-center gap-3 pt-2 border-t border-input-border">${statsItems.join("")}</div>`
            : "";

        const authorName = article.expand?.author?.preferred_username || article.expand?.author?.username || "Auteur";

        container.innerHTML = `
            ${coverUrl ? `
                <div class="relative h-36 w-full overflow-hidden bg-neutral-900 shrink-0">
                    <img src="${coverUrl}" alt="" class="w-full h-full object-cover" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    <div class="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-white shadow-xs">
                            <i class="fa-solid fa-compass"></i> Récit d'aventure
                        </span>
                        <span class="text-[11px] font-medium text-white/90 drop-shadow-xs">${escapeHtml(authorName)}</span>
                    </div>
                </div>
            ` : `
                <div class="p-3 bg-gradient-to-r from-primary/20 to-primary/10 border-b border-input-border flex items-center justify-between">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-white shadow-xs">
                        <i class="fa-solid fa-compass"></i> Récit d'aventure
                    </span>
                    <span class="text-xs font-medium text-content/70">${escapeHtml(authorName)}</span>
                </div>
            `}

            <div class="p-4 space-y-3 bg-surface">
                <h3 class="text-base font-serif font-bold text-content leading-snug line-clamp-2">
                    ${escapeHtml(article.title)}
                </h3>

                ${article.intro ? `
                    <p class="text-xs font-serif italic text-content/75 line-clamp-2 leading-relaxed">
                        ${escapeHtml(article.intro)}
                    </p>
                ` : ""}

                ${statsHtml}

                <div class="pt-1">
                    <a
                        href="/articles/${article.id}"
                        class="btn-primary w-full text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all"
                    >
                        <span>Lire le récit complet</span>
                        <i class="fa-solid fa-arrow-right text-[10px]"></i>
                    </a>
                </div>
            </div>
        `;

        popup.setDOMContent(container);
        return popup;
    }

    function escapeHtml(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
</script>

<style>
    /*
     * Super Pin Marker Container
     * Positioned by MapLibre using anchor: 'bottom'.
     * Structure:
     * - Child 1: .super-pin-pill (top)
     * - Child 2: .super-pin-pointer (bottom, downward-pointing triangle in normal flow)
     * The bottom-most pixel of this container is the exact tip of the downward triangle,
     * placing the entire pin strictly ABOVE the start point.
     */
    :global(.super-pin-container) {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: max-content;
        max-width: 290px;
        pointer-events: auto;
        /* Critical: DO NOT set CSS transform here to avoid overriding MapLibre's marker placement */
    }

    /*
     * The pill containing thumbnail, badge and title
     */
    :global(.super-pin-pill) {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.375rem 0.875rem 0.375rem 0.375rem;
        border-radius: 9999px; /* RADIUS.pill */
        background-color: rgba(var(--surface), 0.95);
        color: rgb(var(--content));
        border: 2px solid rgb(var(--primary));
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15);
        backdrop-filter: blur(8px);
        transform-origin: bottom center;
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, border-color 0.2s ease;
        max-width: 285px;
        box-sizing: border-box;
    }

    :global(.super-pin-thumb) {
        width: 32px;
        height: 32px;
        border-radius: 9999px;
        object-fit: cover;
        flex-shrink: 0;
        border: 1.5px solid rgb(var(--primary));
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    :global(.super-pin-thumb-placeholder) {
        width: 32px;
        height: 32px;
        border-radius: 9999px;
        background-color: rgba(var(--primary), 0.15);
        color: rgb(var(--primary));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        flex-shrink: 0;
        border: 1.5px solid rgba(var(--primary), 0.4);
    }

    :global(.super-pin-content) {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1 1 auto;
        overflow: hidden;
    }

    :global(.super-pin-badge) {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgb(var(--primary));
        line-height: 1.1;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-family: var(--font-sans);
    }

    :global(.super-pin-badge i) {
        font-size: 9px;
    }

    :global(.super-pin-title) {
        display: block;
        font-size: 13px;
        font-weight: 700;
        font-family: var(--font-serif);
        color: rgb(var(--content));
        line-height: 1.25;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 185px;
    }

    :global(.super-pin-chevron) {
        font-size: 10px;
        color: rgba(var(--content), 0.45);
        margin-left: 1px;
        flex-shrink: 0;
        transition: color 0.2s ease, transform 0.2s ease;
    }

    /*
     * Downward-pointing pointer triangle in normal document flow.
     * Tip is at the absolute bottom of the marker container.
     */
    :global(.super-pin-pointer) {
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 10px solid rgb(var(--primary));
        margin-top: -1px; /* Seamless attachment to pill bottom border */
        flex-shrink: 0;
        filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
        transition: border-top-color 0.2s ease;
    }

    /*
     * Hover & active state animations
     * Scales upwards and outwards from bottom center without shifting the pointer anchor tip.
     */
    :global(.super-pin-container:hover .super-pin-pill),
    :global(.super-pin-hovered .super-pin-pill) {
        transform: scale(1.05);
        border-color: rgb(var(--primary-hover)) !important;
        box-shadow: 0 12px 28px -3px rgba(var(--primary), 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2) !important;
    }

    :global(.super-pin-container:hover .super-pin-chevron),
    :global(.super-pin-hovered .super-pin-chevron) {
        color: rgb(var(--primary-hover));
        transform: translateX(2px);
    }

    :global(.super-pin-container:hover .super-pin-pointer),
    :global(.super-pin-hovered .super-pin-pointer) {
        border-top-color: rgb(var(--primary-hover)) !important;
    }

    /* MapLibre Popup Styling Customization */
    :global(.maplibregl-popup.article-super-popup .maplibregl-popup-content) {
        padding: 0;
        border-radius: 1rem; /* RADIUS.card (16px) */
        overflow: hidden;
        border: 1px solid rgba(var(--separator), 0.8);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.15);
        background: rgb(var(--surface));
    }

    :global(.maplibregl-popup.article-super-popup .maplibregl-popup-close-button) {
        padding: 6px 10px;
        color: rgb(var(--content));
        font-size: 16px;
        z-index: 10;
    }
</style>
