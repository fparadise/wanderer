<script lang="ts">
    import MapWithElevationMaplibre from "$lib/components/trail/map_with_elevation_maplibre.svelte";
    import DifficultyBadge from "$lib/components/article/difficulty_badge.svelte";
    import { RADIUS } from "$lib/config/design_system";
    import { show_toast } from "$lib/stores/toast_store.svelte";
    import { currentUser } from "$lib/stores/user_store";
    import { getFileURL, isVideoURL } from "$lib/util/file_util";
    import { formatDistance, formatElevation } from "$lib/util/format_util";
    import {
        parseTrackPoints,
        getCoordinateAtKm,
        findKmForCoordinate,
        findPointForTimestamp,
        parseExifDate,
        convertDMStoDecimal,
        extractQuoteFromHtml,
        type TrackPointWithDistance,
    } from "$lib/util/pk_util";
    import EXIF from "$lib/vendor/exif-js/exif.js";
    import { TECHNICAL_DIFFICULTY_LEVELS } from "$lib/models/editorial_tags";
    import {
        type ArticleMediaItem,
        extractBaseFileName,
        deduplicateGroupPhotos,
    } from "$lib/models/article_media";
    import { TRAIL_COLORS } from "$lib/config/map";
    import { articles_update } from "$lib/stores/article_store";
    import PhotoGallery from "$lib/components/photo_gallery.svelte";
    import "photoswipe/style.css";
    import type { PageData } from "./$types";
    import * as M from "maplibre-gl";
    import { onDestroy } from "svelte";

    // Safeguard MapLibre Marker against internal _updateOpacity crash when marker is removed
    if (typeof window !== "undefined" && (M as any).Marker) {
        const MarkerProto = (M as any).Marker.prototype;
        if (MarkerProto && !MarkerProto.__opacityPatched) {
            const origUpdateOpacity = MarkerProto._updateOpacity;
            if (typeof origUpdateOpacity === "function") {
                MarkerProto._updateOpacity = function (force?: boolean) {
                    if (!this._map || !this._map.transform) return;
                    return origUpdateOpacity.call(this, force);
                };
                MarkerProto.__opacityPatched = true;
            }
        }
    }

    let { data }: { data: PageData } = $props();

    let gallery: PhotoGallery | undefined = $state();

    let article = $derived(data.article);
    let linkedTrails = $derived(article.expand?.relation || []);
    let author = $derived(article.expand?.author);
    let authorName = $derived(author?.preferred_username || author?.username || "Auteur");
    let participants = $derived(article.expand?.participants || []);
    let tags = $derived(article.tags || []);
    let techDiff = $derived(
        article.technical_difficulty ? TECHNICAL_DIFFICULTY_LEVELS[article.technical_difficulty] : null
    );

    let canEdit = $derived(
        $currentUser &&
        (article.author === $currentUser.actor ||
         author?.user === $currentUser.id ||
         $currentUser.is_admin === true)
    );

    let isTogglingFeatured = $state(false);
    let isFeatured = $derived(article.featured ?? false);

    async function toggleFeatured() {
        if (!article.id || isTogglingFeatured) return;
        isTogglingFeatured = true;
        try {
            const nextFeatured = !isFeatured;
            await articles_update(article.id, { featured: nextFeatured });
            article.featured = nextFeatured;
            show_toast({
                type: "success",
                icon: "check",
                text: nextFeatured
                    ? "Récit mis à la une sur l'accueil !"
                    : "Récit retiré de la une.",
            });
        } catch (e: any) {
            console.error(e);
            show_toast({
                type: "error",
                icon: "close",
                text: "Erreur lors de la mise à jour de la mise en avant.",
            });
        } finally {
            isTogglingFeatured = false;
        }
    }

    let mainHeroImage = $derived(
        article.hero_images && article.hero_images.length > 0
            ? getFileURL(article, article.hero_images[0])
            : null
    );

    interface PkMapItem {
        stage: number;
        km: number;
        marker: M.Marker;
        element: HTMLElement;
        popup: M.Popup;
        coord: { lat: number; lon: number };
    }

    interface PhotoMapItem {
        photoId: string;
        marker: M.Marker;
        element: HTMLElement;
        popup?: M.Popup;
    }

    let map: M.Map | undefined = $state();
    let isMapFullscreen = $state(false);
    let isMapDrawerOpen = $state(false);
    let activeKmInfo = $state<string | null>(null);
    let showFloatingFab = $state(false);
    let mapAnchorEl: HTMLElement | null = $state(null);

    function toggleFullscreen() {
        isMapFullscreen = !isMapFullscreen;
        if (isMapFullscreen) {
            (map as any)?.cooperativeGestures?.disable();
        } else {
            (map as any)?.cooperativeGestures?.enable();
        }
        setTimeout(() => {
            map?.resize();
        }, 80);
    }

    function openDrawer(infoLabel?: string) {
        if (infoLabel) activeKmInfo = infoLabel;
        isMapDrawerOpen = true;
        setTimeout(() => {
            map?.resize();
        }, 80);
        setTimeout(() => {
            map?.resize();
        }, 320);
    }

    function closeDrawer() {
        isMapDrawerOpen = false;
        setTimeout(() => {
            map?.resize();
        }, 80);
        setTimeout(() => {
            map?.resize();
        }, 320);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            if (isMapFullscreen) {
                toggleFullscreen();
            } else if (isMapDrawerOpen) {
                closeDrawer();
            }
        }
    }

    let pkMapItems: PkMapItem[] = [];
    let photoMapItems: PhotoMapItem[] = [];
    let scannedPhotoLocations = $state<Record<string, { lat: number; lon: number; pkKm?: number; timestamp?: number }>>({});

    // Track points per stage for PK calculations
    let stageTrackPoints = $derived.by(() => {
        return linkedTrails.map((trail: any) => {
            if (trail.expand?.track_points) {
                return trail.expand.track_points;
            }
            const gpxRaw = trail.expand?.gpx_data;
            return parseTrackPoints(gpxRaw);
        });
    });

    // Aggregated photos from linked activities with calculated PK
    let aggregatedPhotos = $derived.by(() => {
        const photos: ArticleMediaItem[] = [];

        linkedTrails.forEach((t, stageIdx) => {
            const stageLabel = `Étape ${stageIdx + 1}`;
            const points = stageTrackPoints[stageIdx] || [];

            // 1. First collect waypoint photos (they have explicit coordinates & POI names)
            const knownWaypointNames = new Set<string>();
            const knownWaypointBaseNames = new Set<string>();

            (t.expand?.waypoints_via_trail || []).forEach((wp) => {
                let pkKm: number | undefined;
                if (wp.lat !== undefined && wp.lon !== undefined && points.length > 0) {
                    const match = findKmForCoordinate(points, wp.lat, wp.lon);
                    if (match) pkKm = match.km;
                }

                (wp.photos || []).forEach((pName, pIdx) => {
                    knownWaypointNames.add(pName);
                    const base = extractBaseFileName(pName);
                    const nameWithoutExt = base.replace(/\.[^.]+$/, "");
                    if (nameWithoutExt.length >= 3) {
                        knownWaypointBaseNames.add(base);
                    }

                    photos.push({
                        id: `${wp.id}-wp-${pIdx}`,
                        url: getFileURL(wp, pName),
                        sourceTrailId: t.id!,
                        sourceTrailName: t.name,
                        stageIndex: stageIdx,
                        stageLabel,
                        lat: wp.lat,
                        lon: wp.lon,
                        pkKm,
                        type: "waypoint_photo",
                        caption: wp.name || t.name,
                        fileName: pName,
                    });
                });
            });

            // 2. Photos from trail gallery (skip if already covered by waypoint photos)
            (t.photos || []).forEach((pName, pIdx) => {
                const base = extractBaseFileName(pName);
                const nameWithoutExt = base.replace(/\.[^.]+$/, "");
                const isDuplicate = knownWaypointNames.has(pName) || (nameWithoutExt.length >= 3 && knownWaypointBaseNames.has(base));
                if (isDuplicate) {
                    return; // Skip duplicate trail photo already included as a waypoint photo
                }

                photos.push({
                    id: `${t.id}-photo-${pIdx}`,
                    url: getFileURL(t, pName),
                    sourceTrailId: t.id!,
                    sourceTrailName: t.name,
                    stageIndex: stageIdx,
                    stageLabel,
                    type: "trail_photo",
                    caption: t.name,
                    fileName: pName,
                });
            });

            // 3. Summit logs photos
            (t.expand?.summit_logs_via_trail || []).forEach((log) => {
                (log.photos || []).forEach((pName, pIdx) => {
                    photos.push({
                        id: `${log.id}-log-${pIdx}`,
                        url: getFileURL(log, pName),
                        sourceTrailId: t.id!,
                        sourceTrailName: t.name,
                        stageIndex: stageIdx,
                        stageLabel,
                        type: "summit_photo",
                        caption: `Sortie du ${new Date(log.date).toLocaleDateString()}`,
                        fileName: pName,
                    });
                });
            });
        });

        // 4. Custom uploaded hero images as fallback/complement
        if (article.hero_images && article.hero_images.length > 1) {
            article.hero_images.slice(1).forEach((img, idx) => {
                photos.push({
                    id: `hero-extra-${idx}`,
                    url: getFileURL(article, img),
                    sourceTrailId: "",
                    sourceTrailName: "",
                    stageIndex: 0,
                    stageLabel: "Récit",
                    type: "custom_upload",
                    caption: "Photo du voyage",
                    fileName: img,
                });
            });
        }

        const excludedSet = new Set(article.excluded_photos || []);
        const filtered = photos.filter(
            (p) =>
                !excludedSet.has(p.url) &&
                (!p.fileName || !excludedSet.has(p.fileName)) &&
                (!p.id || !excludedSet.has(p.id))
        );

        return filtered.map((p) => {
            if (scannedPhotoLocations[p.id]) {
                return {
                    ...p,
                    lat: scannedPhotoLocations[p.id].lat,
                    lon: scannedPhotoLocations[p.id].lon,
                    pkKm: scannedPhotoLocations[p.id].pkKm ?? p.pkKm,
                    timestamp: scannedPhotoLocations[p.id].timestamp ?? p.timestamp,
                };
            }
            return p;
        });
    });

    async function extractExifFromImageUrl(url: string): Promise<{ lat?: number; lon?: number; timestamp?: number } | null> {
        if (typeof window === "undefined") return null;
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const buffer = await res.arrayBuffer();
            const tags = EXIF.readFromBinaryFile(buffer);
            if (!tags) return null;

            const lat = tags.GPSLatitude;
            const latRef = tags.GPSLatitudeRef;
            const lon = tags.GPSLongitude;
            const lonRef = tags.GPSLongitudeRef;
            const dateTaken = tags.DateTimeOriginal || tags.DateTime;

            let resLat: number | undefined;
            let resLon: number | undefined;
            let resTime: number | undefined;

            if (lat && lon) {
                resLat = convertDMStoDecimal(lat, latRef || "N");
                resLon = convertDMStoDecimal(lon, lonRef || "E");
            }
            if (dateTaken) {
                const parsed = parseExifDate(dateTaken);
                if (parsed) resTime = parsed;
            }

            if (resLat !== undefined || resTime !== undefined) {
                return { lat: resLat, lon: resLon, timestamp: resTime };
            }
            return null;
        } catch {
            return null;
        }
    }

    async function scanPhotosExif() {
        const unscanned = aggregatedPhotos.filter((p) => p.lat === undefined || p.lon === undefined);
        for (const photo of unscanned) {
            try {
                const exif = await extractExifFromImageUrl(photo.url);
                if (!exif) continue;

                const stageIdx = Math.max(0, photo.stageIndex);
                const points = stageTrackPoints[stageIdx] || stageTrackPoints[0] || [];

                let matchedLat: number | undefined;
                let matchedLon: number | undefined;
                let matchedKm: number | undefined;

                const TOLERANCE_METERS = 200; // Distance max pour considérer la coordonnée sur la trace

                // 1. Vérifier si les coordonnées GPS sont sur la trace dans la tolérance
                const coordMatch = (exif.lat !== undefined && exif.lon !== undefined && points.length > 0)
                    ? findKmForCoordinate(points, exif.lat, exif.lon, TOLERANCE_METERS)
                    : null;

                // 2. Vérifier si le timestamp correspond à un point de la trace GPX
                const timeMatch = (exif.timestamp !== undefined && points.length > 0)
                    ? findPointForTimestamp(points, exif.timestamp)
                    : null;

                if (coordMatch) {
                    // Les coordonnées GPS sont sur la trace (dans la tolérance) -> on cale sur le point de trace
                    matchedLat = coordMatch.point.lat;
                    matchedLon = coordMatch.point.lon;
                    matchedKm = coordMatch.km;
                } else if (timeMatch) {
                    // Les coordonnées GPS sont hors trace (ou absentes), mais le timestamp correspond à la trace !
                    matchedLat = timeMatch.lat;
                    matchedLon = timeMatch.lon;
                    matchedKm = timeMatch.km;
                } else if (exif.lat !== undefined && exif.lon !== undefined) {
                    // Coordonnées GPS hors trace et pas de timestamp correspondant -> on garde le GPS brut
                    matchedLat = exif.lat;
                    matchedLon = exif.lon;
                    const fallbackMatch = findKmForCoordinate(points, exif.lat, exif.lon, 2000);
                    if (fallbackMatch) matchedKm = fallbackMatch.km;
                }

                if (matchedLat !== undefined && matchedLon !== undefined) {
                    scannedPhotoLocations = {
                        ...scannedPhotoLocations,
                        [photo.id]: {
                            lat: matchedLat,
                            lon: matchedLon,
                            pkKm: matchedKm,
                            timestamp: exif.timestamp,
                        },
                    };
                }
            } catch {
                // Ignore individual photo error
            }
        }
    }

    let deleting: boolean = $state(false);

    // Text -> Map interaction
    function focusKmOnMap(stage: number, km: number, label: string = "", targetEl?: HTMLElement) {
        if (!map) return;
        const stageIdx = Math.max(0, stage - 1);
        const points = stageTrackPoints[stageIdx] || [];
        const coord = getCoordinateAtKm(points, km);

        if (!coord) {
            show_toast({ type: "info", icon: "location-dot", text: `Repère Étape ${stage} · km ${km}` });
            return;
        }

        const stagePrefix = linkedTrails.length > 1 ? `Étape ${stage} · ` : "";
        const kmLabel = `${stagePrefix}KM ${km}${label ? ` · ${label}` : ''}`;

        // Auto-open drawer when interacting with text tags
        openDrawer(kmLabel);

        const executeFly = () => {
            map?.flyTo({
                center: [coord.lon, coord.lat],
                zoom: 14,
                speed: 1.2,
            });

            // Close any other open popups and restore markers
            pkMapItems.forEach((item) => {
                if (item.popup.isOpen()) {
                    item.popup.remove();
                }
                item.element.style.opacity = "1";
                item.element.style.visibility = "visible";
                item.element.style.pointerEvents = "auto";
            });
            photoMapItems.forEach((item) => {
                if (item.popup?.isOpen()) {
                    item.popup.remove();
                }
                item.element.style.opacity = "1";
                item.element.style.visibility = "visible";
                item.element.style.pointerEvents = "auto";
            });

            // Find existing marker on map
            const existing = pkMapItems.find((item) => item.stage === stage && Math.abs(item.km - km) < 0.1);
            if (existing) {
                if (!existing.popup.isOpen()) {
                    existing.marker.togglePopup();
                }
                // Explicitly hide marker when its popup description is shown
                existing.element.style.opacity = "0";
                existing.element.style.visibility = "hidden";
                existing.element.style.pointerEvents = "none";
            } else {
                const stageColor = TRAIL_COLORS[stageIdx % TRAIL_COLORS.length];
                const stageLabel = linkedTrails.length > 1 ? `Étape ${stage}` : "";
                new M.Popup({ offset: 10, closeButton: true })
                    .setLngLat([coord.lon, coord.lat])
                    .setHTML(`
                        <div class="p-1.5 space-y-1.5 max-w-[250px]">
                            <div class="font-bold text-xs flex items-center gap-1.5" style="color: ${stageColor}">
                                <i class="fa-solid fa-location-dot"></i>
                                <span>${stageLabel ? stageLabel + ' · ' : ''}KM ${km}</span>
                            </div>
                            ${label ? `<p class="text-xs font-semibold text-content">${label}</p>` : ''}
                        </div>
                    `)
                    .addTo(map!);
            }
        };

        if (isMapDrawerOpen) {
            executeFly();
        } else {
            setTimeout(executeFly, 150);
        }
    }

    // Map Toolbar: Photo toggle control
    let showPhotosOnMap: boolean = $state(true);
    let photoToggleControl: PhotoToggleControl | null = null;

    class PhotoToggleControl implements M.IControl {
        private buttonContainer?: HTMLDivElement;
        private button?: HTMLButtonElement;
        private isVisible: boolean = true;
        private onToggle: () => void;

        constructor(onToggle: () => void, initialVisible: boolean = true) {
            this.onToggle = onToggle;
            this.isVisible = initialVisible;
        }

        onAdd(map: M.Map): HTMLElement {
            this.buttonContainer = document.createElement("div");
            this.buttonContainer.classList.add(
                "maplibregl-ctrl",
                "maplibregl-ctrl-group"
            );

            this.button = document.createElement("button");
            this.button.type = "button";
            this.button.className = "flex items-center justify-center";
            this.updateState(this.isVisible);

            this.button.addEventListener("click", () => {
                this.onToggle();
            });

            this.buttonContainer.appendChild(this.button);
            return this.buttonContainer;
        }

        updateState(visible: boolean) {
            this.isVisible = visible;
            if (!this.button) return;
            this.button.title = visible ? "Masquer les photos sur la trace" : "Afficher les photos sur la trace";
            this.button.setAttribute("aria-label", this.button.title);
            if (visible) {
                this.button.innerHTML = `
                    <i class="fa-solid fa-camera text-neutral-800 dark:text-neutral-200 text-xs"></i>
                `;
            } else {
                this.button.innerHTML = `
                    <span class="relative inline-flex items-center justify-center w-4 h-4">
                        <i class="fa-solid fa-camera text-neutral-800 dark:text-neutral-200 text-xs"></i>
                        <i class="fa-solid fa-slash absolute text-neutral-800 dark:text-neutral-200 text-xs scale-90"></i>
                    </span>
                `;
            }
        }

        onRemove(): void {
            if (this.buttonContainer?.parentNode) {
                this.buttonContainer.parentNode.removeChild(this.buttonContainer);
            }
            this.buttonContainer = undefined;
            this.button = undefined;
        }
    }

    function togglePhotosOnMap() {
        showPhotosOnMap = !showPhotosOnMap;
        photoToggleControl?.updateState(showPhotosOnMap);
        photoMapItems.forEach((item) => {
            if (showPhotosOnMap) {
                item.element.style.display = "";
            } else {
                item.element.style.display = "none";
                if (item.popup?.isOpen()) {
                    item.popup.remove();
                }
            }
        });
    }

    // Photo -> Map interaction (Strava-style thumbnail markers)
    function focusPhotoOnMap(photo: ArticleMediaItem) {
        if (!map) return;
        if (photo.lat !== undefined && photo.lon !== undefined) {
            if (!showPhotosOnMap) {
                togglePhotosOnMap();
            }

            const photoLabel = `${photo.stageLabel}${photo.pkKm !== undefined ? ` · KM ${photo.pkKm.toFixed(1)}` : ''}${photo.caption ? ` · ${photo.caption}` : ''}`;
            openDrawer(photoLabel);

            const targetLon = photo.lon;
            const targetLat = photo.lat;
            const executeFly = () => {
                map?.flyTo({ center: [targetLon, targetLat], zoom: 15, speed: 1.2 });

                // Close all popups and restore markers
                pkMapItems.forEach((item) => {
                    if (item.popup.isOpen()) item.popup.remove();
                    item.element.style.opacity = "1";
                    item.element.style.visibility = "visible";
                    item.element.style.pointerEvents = "auto";
                });

                const existing = photoMapItems.find((item) => item.photoId === photo.id);
                if (existing) {
                    existing.element.classList.add("ring-4", "ring-primary", "scale-125");
                    setTimeout(() => {
                        existing.element.classList.remove("ring-4", "ring-primary", "scale-125");
                    }, 2500);
                }
            };

            if (isMapDrawerOpen) {
                executeFly();
            } else {
                setTimeout(executeFly, 150);
            }
        } else if (photo.pkKm !== undefined) {
            focusKmOnMap(photo.stageIndex + 1, photo.pkKm, photo.caption);
        }
    }

    // Delegate click on article body for PK badges (Text -> Map)
    function handleBodyClick(e: MouseEvent) {
        const target = (e.target as HTMLElement).closest(".pk-badge, [data-km]");
        if (!target) return;
        const stage = parseInt(target.getAttribute("data-stage") || "1", 10);
        let km = parseFloat(target.getAttribute("data-km") || "0");
        if (isNaN(km) || km === 0) {
            const match = target.textContent?.match(/KM\s+([\d.]+)/i);
            if (match) km = parseFloat(match[1]);
        }
        focusKmOnMap(stage, km, target.getAttribute("data-label") || target.textContent?.trim() || "", target as HTMLElement);
    }

    // Initialize Map -> Text markers once map is loaded
    function setupPkMarkersOnMap() {
        if (!map) return;
        // Clean previous
        pkMapItems.forEach((item) => item.marker.remove());
        pkMapItems = [];

        // Parse DOM for pk-badges in article body
        const parser = new DOMParser();
        const doc = parser.parseFromString(article.body, "text/html");
        const badges = Array.from(doc.querySelectorAll(".pk-badge, [data-km]"));

        // Deduplicate badges by stage and km to avoid multiple markers on top of each other
        const seen = new Set<string>();
        const uniqueBadges: { stage: number; km: number; label: string; badgeIndex: number }[] = [];

        badges.forEach((b, idx) => {
            const stage = parseInt(b.getAttribute("data-stage") || "1", 10);
            const km = parseFloat(b.getAttribute("data-km") || "0");
            const key = `${stage}_${km.toFixed(1)}`;
            if (!seen.has(key)) {
                seen.add(key);
                const rawLabel = (b.getAttribute("data-label") || b.textContent || "")
                    .replace(/^📍\s*/, "")
                    .replace(/^Étape\s+\d+\s*[·•-]\s*/i, "")
                    .replace(/^KM\s+[\d.]+\s*[·•-]\s*/i, "")
                    .trim();
                uniqueBadges.push({ stage, km, label: rawLabel, badgeIndex: idx });
            }
        });

        uniqueBadges.forEach(({ stage, km, label, badgeIndex }) => {
            const stageIdx = Math.max(0, stage - 1);
            const points = stageTrackPoints[stageIdx] || [];
            const coord = getCoordinateAtKm(points, km);
            if (!coord) return;

            const stageColor = TRAIL_COLORS[stageIdx % TRAIL_COLORS.length];
            const quote = extractQuoteFromHtml(article.body, `km ${km}`) || label;
            const stageLabel = linkedTrails.length > 1 ? `Étape ${stage}` : "";

            // Use 10-15 characters of the label/description if available, otherwise fallback to km
            let displayBadgeText = `${km} km`;
            const cleanLabel = (label || "").trim();
            if (cleanLabel.length > 0) {
                displayBadgeText = cleanLabel.length > 14 ? cleanLabel.slice(0, 13).trim() + "…" : cleanLabel;
            }

            const markerEl = document.createElement("div");
            markerEl.className = "pk-map-pin select-none cursor-pointer transition-opacity duration-200";
            markerEl.style.zIndex = "12";

            // Centered milestone badge directly on the trace line, styled like the text tag
            markerEl.innerHTML = `
                <div class="pk-pin-inner inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-md border transition-transform hover:scale-110"
                     style="background-color: #ffffff; background-color: color-mix(in srgb, ${stageColor} 12%, white); color: ${stageColor}; border-color: ${stageColor}; box-shadow: 0 1px 4px rgba(0,0,0,0.25);"
                     title="${label ? `${label} (KM ${km})` : `KM ${km}`}">
                    <i class="fa-solid fa-location-dot text-[9px]"></i>
                    <span class="max-w-[130px] truncate">${displayBadgeText}</span>
                </div>
            `;

            // Crucial: Stop mouse events so elevation crosshair / trail hover dot doesn't jump or move under marker
            markerEl.addEventListener("mousemove", (e) => e.stopPropagation());
            markerEl.addEventListener("mouseenter", (e) => e.stopPropagation());
            markerEl.addEventListener("mouseover", (e) => e.stopPropagation());
            markerEl.addEventListener("mousedown", (e) => e.stopPropagation());
            markerEl.addEventListener("pointerdown", (e) => e.stopPropagation());
            markerEl.addEventListener("pointermove", (e) => e.stopPropagation());

            const popupContent = document.createElement("div");
            popupContent.className = "p-1.5 space-y-1.5 max-w-[250px]";
            popupContent.innerHTML = `
                <div class="font-bold text-xs flex items-center gap-1.5" style="color: ${stageColor}">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${stageLabel ? stageLabel + ' · ' : ''}KM ${km}</span>
                </div>
                ${label ? `<p class="text-xs font-semibold text-content">${label}</p>` : ''}
                ${quote && quote !== label ? `<p class="text-xs text-content/70 italic line-clamp-3 font-serif">"${quote}"</p>` : ''}
                <button type="button" class="btn-scroll-text text-[11px] font-semibold hover:underline block pt-1" style="color: ${stageColor}">
                    Lire dans le récit ↓
                </button>
            `;

            popupContent.querySelector(".btn-scroll-text")?.addEventListener("click", () => {
                const domBadges = document.querySelectorAll(".pk-badge, [data-km]");
                const targetDom = domBadges[badgeIndex] as HTMLElement;
                if (targetDom) {
                    targetDom.scrollIntoView({ behavior: "smooth", block: "center" });
                    targetDom.classList.add("ring-4", "ring-primary", "scale-105");
                    setTimeout(() => {
                        targetDom.classList.remove("ring-4", "ring-primary", "scale-105");
                    }, 2500);
                }
            });

            const popup = new M.Popup({ offset: 10, closeButton: true }).setDOMContent(popupContent);

            // Hide the pin marker when its description popup is open, restore when closed
            popup.on("open", () => {
                markerEl.style.opacity = "0";
                markerEl.style.visibility = "hidden";
                markerEl.style.pointerEvents = "none";
            });
            popup.on("close", () => {
                markerEl.style.opacity = "1";
                markerEl.style.visibility = "visible";
                markerEl.style.pointerEvents = "auto";
            });

            markerEl.addEventListener("click", (e) => {
                e.stopPropagation();
                marker.togglePopup();
            });

            const marker = new M.Marker({ element: markerEl, anchor: "center" })
                .setLngLat([coord.lon, coord.lat])
                .setPopup(popup)
                .addTo(map!);

            pkMapItems.push({ stage, km, marker, element: markerEl, popup, coord });
        });
    }

    // Initialize Strava-style photo thumbnails on the map
    function setupPhotoMarkersOnMap() {
        if (!map) return;
        // Clean previous
        photoMapItems.forEach((item) => item.marker.remove());
        photoMapItems = [];

        const geoPhotos = aggregatedPhotos.filter((p) => p.lat !== undefined && p.lon !== undefined);

        // Group photos that are at the exact same location or very close (~30m) to avoid stacking identical pins
        interface PhotoGroup {
            lat: number;
            lon: number;
            stageIndex: number;
            stageLabel: string;
            pkKm?: number;
            photos: ArticleMediaItem[];
        }
        const groups: PhotoGroup[] = [];
        geoPhotos.forEach((photo) => {
            const existing = groups.find((g) => {
                const dLat = Math.abs(g.lat - photo.lat!);
                const dLon = Math.abs(g.lon - photo.lon!);
                return dLat < 0.0003 && dLon < 0.0003;
            });
            if (existing) {
                existing.photos.push(photo);
            } else {
                groups.push({
                    lat: photo.lat!,
                    lon: photo.lon!,
                    stageIndex: photo.stageIndex,
                    stageLabel: photo.stageLabel,
                    pkKm: photo.pkKm,
                    photos: [photo],
                });
            }
        });

        groups.forEach((group) => {
            // Deduplicate within the group (eliminating any duplicates between waypoint and trail photos)
            group.photos = deduplicateGroupPhotos(group.photos);
            if (group.photos.length === 0) return;

            const stageIdx = Math.max(0, group.stageIndex);
            const stageColor = TRAIL_COLORS[stageIdx % TRAIL_COLORS.length];
            const coverPhoto = group.photos[0];
            const count = group.photos.length;

            const markerEl = document.createElement("div");
            markerEl.className = "pk-photo-pin select-none cursor-pointer transition-opacity duration-200";
            markerEl.style.zIndex = "10";
            if (!showPhotosOnMap) {
                markerEl.style.display = "none";
            }

            const cleanCaption = (coverPhoto.caption || "").trim();
            const tooltipTitle = `${group.stageLabel}${group.pkKm !== undefined ? ` · KM ${group.pkKm.toFixed(1)}` : ''}${cleanCaption ? ` · ${cleanCaption}` : ''}`;

            // Strava-style square thumbnail marker directly on the trace line (clean photo, no km text)
            markerEl.innerHTML = `
                <div class="pk-photo-inner w-8 h-8 rounded-lg overflow-hidden border-2 shadow-md bg-cover bg-center group relative transition-transform duration-150 hover:scale-110"
                     style="border-color: ${stageColor}; background-image: url('${coverPhoto.url}'); box-shadow: 0 2px 6px rgba(0,0,0,0.35);"
                     title="${tooltipTitle}">
                    <div class="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors"></div>
                    ${count > 1 ? `
                        <div class="absolute top-0.5 right-0.5 bg-black/80 text-white text-[8px] font-bold px-1 rounded-full leading-tight backdrop-blur-xs shadow-xs">
                            +${count}
                        </div>
                    ` : ''}
                </div>
            `;

            // Stop mouse and pointer events so elevation crosshair / trail hover dot doesn't jump or move under marker
            markerEl.addEventListener("mousemove", (e) => e.stopPropagation());
            markerEl.addEventListener("mouseenter", (e) => e.stopPropagation());
            markerEl.addEventListener("mouseover", (e) => e.stopPropagation());
            markerEl.addEventListener("mousedown", (e) => e.stopPropagation());
            markerEl.addEventListener("pointerdown", (e) => e.stopPropagation());
            markerEl.addEventListener("pointermove", (e) => e.stopPropagation());

            markerEl.addEventListener("click", (e) => {
                e.stopPropagation();
                // Close other open popups
                pkMapItems.forEach((item) => {
                    if (item.popup.isOpen()) item.popup.remove();
                });
                const photoIdx = aggregatedPhotos.findIndex((p) => p.id === coverPhoto.id);
                if (photoIdx !== -1) {
                    gallery?.openGallery(photoIdx);
                }
            });

            const marker = new M.Marker({ element: markerEl, anchor: "center" })
                .setLngLat([group.lon, group.lat])
                .addTo(map!);

            photoMapItems.push({ photoId: coverPhoto.id, marker, element: markerEl });
        });
    }

    // Format text badges to ensure uniform pin icon, "KM xx" prefix, and stage color
    function formatArticleBadges() {
        if (typeof document === "undefined") return;
        const bodyEl = document.querySelector(".article-body");
        if (!bodyEl) return;
        const badges = bodyEl.querySelectorAll(".pk-badge, [data-km]");
        badges.forEach((b) => {
            const stage = parseInt(b.getAttribute("data-stage") || "1", 10);
            const km = parseFloat(b.getAttribute("data-km") || "0");
            const stageIdx = Math.max(0, stage - 1);
            const color = TRAIL_COLORS[stageIdx % TRAIL_COLORS.length];
            const rawLabel = (b.getAttribute("data-label") || b.textContent || "")
                .replace(/^📍\s*/, "")
                .replace(/^Étape\s+\d+\s*[·•-]\s*/i, "")
                .replace(/^KM\s+[\d.]+\s*[·•-]\s*/i, "")
                .trim();

            const stagePrefix = linkedTrails.length > 1 ? `Étape ${stage} · ` : "";
            const displayText = rawLabel ? `${stagePrefix}KM ${km} · ${rawLabel}` : `${stagePrefix}KM ${km}`;

            const el = b as HTMLElement;
            el.style.backgroundColor = `${color}18`;
            el.style.color = color;
            el.style.borderColor = `${color}45`;
            el.innerHTML = `<i class="fa-solid fa-location-dot text-[10px] mr-1.5"></i><span>${displayText}</span>`;
        });
    }

    $effect(() => {
        if (map && stageTrackPoints.length > 0 && article.body) {
            setupPkMarkersOnMap();
        }
    });

    $effect(() => {
        if (map && aggregatedPhotos.length > 0) {
            setupPhotoMarkersOnMap();
            if (!photoToggleControl) {
                photoToggleControl = new PhotoToggleControl(togglePhotosOnMap, showPhotosOnMap);
                map.addControl(photoToggleControl, "top-right");
            }
        }
    });

    let scannedExif = false;
    $effect(() => {
        if (!scannedExif && aggregatedPhotos.length > 0 && stageTrackPoints.length > 0) {
            scannedExif = true;
            scanPhotosExif();
        }
    });

    $effect(() => {
        if (article.body) {
            setTimeout(formatArticleBadges, 50);
        }
    });

    $effect(() => {
        if (typeof window === "undefined" || !mapAnchorEl) return;
        const handleScroll = () => {
            if (!mapAnchorEl) return;
            const rect = mapAnchorEl.getBoundingClientRect();
            // Le FAB apparait dès que le haut de la section carte commence à sortir de l'écran
            showFloatingFab = rect.top < -120;
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    });

    onDestroy(() => {
        if (photoToggleControl && map) {
            try {
                map.removeControl(photoToggleControl);
            } catch {}
            photoToggleControl = null;
        }
        pkMapItems.forEach((item) => item.marker.remove());
        pkMapItems = [];
        photoMapItems.forEach((item) => item.marker.remove());
        photoMapItems = [];
    });
</script>

<svelte:window onkeydown={handleKeyDown} />

<svelte:head>
    <title>{article.title} | Magazine Wanderer</title>
</svelte:head>

<article class="min-h-screen pb-20 transition-[padding] duration-300 {isMapDrawerOpen && !isMapFullscreen ? 'lg:pr-[460px] xl:pr-[520px] 2xl:pr-[580px]' : ''}">
    <!-- Hero Cover Section -->
    {#if mainHeroImage}
        <div class="relative w-full h-[65vh] min-h-[480px] max-h-[750px] overflow-hidden bg-neutral-900">
            <img
                src={mainHeroImage}
                alt={article.title}
                class="w-full h-full object-cover object-center opacity-85 scale-[1.02] transform transition-transform duration-1000"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
            
            <div class="absolute inset-x-0 bottom-0 max-w-5xl mx-auto px-6 pb-12">
                <div class="space-y-4">
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase bg-primary text-white backdrop-blur-md shadow-md">
                        <i class="fa-solid fa-compass mr-1"></i> Récit de voyage
                    </div>
                    <h1 class="text-4xl md:text-6xl font-serif font-extrabold text-content tracking-tight leading-tight drop-shadow-sm">
                        {article.title}
                    </h1>
                </div>
            </div>
        </div>
    {:else}
        <div class="max-w-5xl mx-auto px-6 pt-12 pb-6">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase bg-primary/10 text-primary mb-4">
                <i class="fa-solid fa-compass mr-1"></i> Récit de voyage
            </div>
            <h1 class="text-4xl md:text-5xl font-serif font-extrabold text-content tracking-tight">
                {article.title}
            </h1>
        </div>
    {/if}

    <!-- Metadata & Tags Bar -->
    <div class="max-w-5xl mx-auto px-6 py-6 border-b border-input-border space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-6">
            <!-- Author & Participants -->
            <div class="flex items-center gap-4">
                {#if author}
                    <div class="w-11 h-11 rounded-full overflow-hidden border-2 border-primary shrink-0 shadow-md">
                        <img
                            src={author.icon ? getFileURL(author, author.icon) : `https://api.dicebear.com/7.x/initials/svg?seed=${author.preferred_username || 'A'}`}
                            alt={author.preferred_username || author.username}
                            class="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <p class="text-sm font-bold text-content">
                            {author.preferred_username || author.username}
                        </p>
                        <p class="text-xs text-content/70">
                            Publié le {new Date(article.date || article.created || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                {/if}

                {#if participants.length > 0}
                    <div class="flex items-center gap-1.5 pl-4 border-l border-input-border">
                        <span class="text-xs text-content/70 mr-1">Avec :</span>
                        {#each participants as p}
                            <span class="text-xs font-medium bg-input-background border border-input-border px-2 py-0.5 rounded-full text-content" title={p.preferred_username || p.username}>
                                {p.preferred_username || p.username}
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Stats & Difficulty Badges -->
            <div class="flex flex-wrap items-center gap-3 text-sm font-semibold">
                {#if article.technical_difficulty}
                    <DifficultyBadge level={article.technical_difficulty} size="pill" />
                {/if}

                {#if article.total_distance > 0}
                    <div class="flex items-center gap-1.5 bg-background border border-input-border px-3 py-1.5 rounded-xl shadow-2xs text-xs font-semibold text-content">
                        <i class="fa-solid fa-route text-primary"></i>
                        <span>{article.total_distance} km</span>
                    </div>
                {/if}
                {#if article.total_elevation_gain > 0}
                    <div class="flex items-center gap-1.5 bg-background border border-input-border px-3 py-1.5 rounded-xl shadow-2xs text-xs font-semibold text-content">
                        <i class="fa-solid fa-mountain text-primary"></i>
                        <span>+{article.total_elevation_gain} m D+</span>
                    </div>
                {/if}
                {#if article.total_days > 0}
                    <div class="flex items-center gap-1.5 bg-background border border-input-border px-3 py-1.5 rounded-xl shadow-2xs text-xs font-semibold text-content">
                        <i class="fa-solid fa-calendar-day text-primary"></i>
                        <span>{article.total_days} {article.total_days > 1 ? 'jours' : 'jour'}</span>
                    </div>
                {/if}

                <!-- Author & Admin Actions -->
                {#if canEdit}
                    <div class="flex items-center gap-1.5 ml-2">
                        {#if $currentUser?.is_admin}
                            <button
                                type="button"
                                onclick={toggleFeatured}
                                disabled={isTogglingFeatured}
                                class="text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-xl shadow-2xs font-semibold transition-all {isFeatured ? 'bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600' : 'btn-secondary'}"
                                title={isFeatured ? "Retirer de la une d'accueil" : "Mettre à la une sur l'accueil"}
                            >
                                <i class="fa-solid fa-star {isFeatured ? 'text-white' : 'text-amber-500'} text-xs"></i>
                                <span>{isFeatured ? "À la une" : "Mettre à la une"}</span>
                            </button>
                        {/if}
                        <a
                            href="/articles/edit/{article.id}"
                            class="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-xl shadow-2xs"
                            title="Modifier l'article"
                        >
                            <i class="fa-solid fa-pen-to-square text-primary text-xs"></i>
                            <span>Modifier</span>
                        </a>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Editorial Tags Pills -->
        {#if tags.length > 0}
            <div class="flex flex-wrap items-center gap-2 pt-2">
                {#each tags as tag}
                    <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                        {tag}
                    </span>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Main Content Layout -->
    <div class="max-w-4xl mx-auto px-6 pt-12 space-y-12">
        <!-- Chapô -->
        {#if article.intro}
            <div class="text-xl md:text-2xl font-serif italic text-content/90 leading-relaxed pl-6 border-l-4 border-primary">
                {article.intro}
            </div>
        {/if}

        <!-- Interactive Map of Linked Trails -->
        {#if linkedTrails.length > 0}
            <div bind:this={mapAnchorEl} id="article-map-anchor" class="space-y-4">
                {#if isMapDrawerOpen && !isMapFullscreen}
                    <!-- Placeholder in page when map is active in drawer -->
                    <div class="w-full h-[180px] md:h-[220px] rounded-2xl border-2 border-dashed border-input-border/70 bg-input-background/25 flex flex-col items-center justify-center p-6 text-center space-y-3 transition-all">
                        <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base">
                            <i class="fa-solid fa-map-location-dot"></i>
                        </div>
                        <div class="space-y-0.5">
                            <p class="text-xs md:text-sm font-bold text-content">La carte est ouverte dans le volet latéral</p>
                            <p class="text-[11px] md:text-xs text-content/60">Vous pouvez continuer à lire le récit tout en explorant la trace.</p>
                        </div>
                        <button
                            type="button"
                            onclick={closeDrawer}
                            class="btn-secondary text-xs py-1.5 px-3 rounded-xl flex items-center gap-2 cursor-pointer hover:border-primary/60 transition-colors"
                        >
                            <i class="fa-solid fa-arrow-down-left-and-up-right-to-center text-[10px]"></i>
                            Replacer la carte ici
                        </button>
                    </div>
                {/if}

                <!-- Persistent Map Container (Inline, Drawer, or Fullscreen) -->
                <div
                    id="article-trail-map"
                    class="{isMapFullscreen
                        ? 'fixed inset-0 z-50 w-screen h-screen rounded-none bg-background flex flex-col'
                        : isMapDrawerOpen
                        ? 'fixed inset-x-0 bottom-0 top-[18vh] lg:top-0 lg:bottom-0 lg:left-auto lg:right-0 lg:w-[460px] xl:w-[520px] 2xl:w-[580px] z-40 bg-background border-t lg:border-t-0 lg:border-l border-input-border shadow-2xl rounded-t-3xl lg:rounded-none flex flex-col overflow-hidden transition-all duration-300'
                        : 'w-full h-[520px] rounded-2xl overflow-hidden border shadow-sm relative flex flex-col'}"
                >
                    <!-- Drawer Header (visible only in drawer mode) -->
                    {#if isMapDrawerOpen && !isMapFullscreen}
                        <div class="flex items-center justify-between px-4 py-2.5 bg-background/95 backdrop-blur-sm border-b border-input-border shrink-0 z-10">
                            <!-- Mobile drag handle pill -->
                            <div class="lg:hidden absolute top-1.5 inset-x-0 flex justify-center pointer-events-none">
                                <span class="w-10 h-1 rounded-full bg-input-border"></span>
                            </div>

                            <div class="flex items-center gap-2 min-w-0 pt-1 lg:pt-0">
                                <span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0"></span>
                                <span class="text-xs font-bold text-content truncate">
                                    {activeKmInfo || "Carte de l'itinéraire"}
                                </span>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0 pt-1 lg:pt-0">
                                <button
                                    type="button"
                                    onclick={toggleFullscreen}
                                    class="w-7 h-7 rounded-lg hover:bg-input-background text-content/70 hover:text-content flex items-center justify-center text-xs transition-colors cursor-pointer"
                                    title="Plein écran"
                                >
                                    <i class="fa-solid fa-expand"></i>
                                </button>
                                <button
                                    type="button"
                                    onclick={closeDrawer}
                                    class="w-7 h-7 rounded-lg hover:bg-input-background text-content/70 hover:text-content flex items-center justify-center text-xs transition-colors cursor-pointer"
                                    title="Fermer le volet et replacer la carte"
                                >
                                    <i class="fa-solid fa-xmark text-sm"></i>
                                </button>
                            </div>
                        </div>
                    {/if}

                    {#if isMapFullscreen}
                        <button
                            type="button"
                            onclick={toggleFullscreen}
                            class="absolute top-4 left-4 z-20 px-3.5 py-2 rounded-xl bg-background/90 backdrop-blur-sm border border-input-border text-content shadow-lg text-xs font-bold hover:bg-primary hover:text-white transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <i class="fa-solid fa-compress"></i>
                            Quitter le plein écran
                        </button>
                    {/if}

                    <!-- Map Canvas Body -->
                    <div class="flex-1 w-full h-full min-h-0 relative">
                        <MapWithElevationMaplibre
                            bind:map
                            trails={linkedTrails}
                            showElevation={true}
                            showFullscreen={!isMapDrawerOpen}
                            onfullscreen={toggleFullscreen}
                            showStyleSwitcher={true}
                            fitAllTrails={true}
                            mapOptions={{
                                cooperativeGestures: true,
                                locale: {
                                    'CooperativeGesturesHandler.WindowsHelpText': 'Utilisez Ctrl + défilement pour zoomer sur la carte',
                                    'CooperativeGesturesHandler.MacHelpText': 'Utilisez ⌘ + défilement pour zoomer sur la carte',
                                    'CooperativeGesturesHandler.MobileHelpText': 'Utilisez deux doigts pour déplacer la carte',
                                }
                            }}
                        />
                    </div>
                </div>

                <!-- Simple list of cards linking to each route / trail page -->
                <div class="grid grid-cols-1 sm:grid-cols-2 {linkedTrails.length > 2 ? 'md:grid-cols-3' : ''} gap-3">
                    {#each linkedTrails as trail, idx}
                        {@const stageColor = TRAIL_COLORS[idx % TRAIL_COLORS.length]}
                        {@const authorName = trail.expand?.author?.preferred_username || trail.expand?.author?.username || trail.author || '_'}
                        <a
                            href="/trail/view/@{authorName}/{trail.id}"
                            class="group p-3.5 rounded-xl border border-input-border bg-background hover:border-primary/60 transition-all shadow-2xs hover:shadow-xs flex items-center justify-between gap-3"
                        >
                            <div class="min-w-0 flex-1 space-y-1">
                                <div class="flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {stageColor};"></span>
                                    <span class="text-[11px] font-bold uppercase tracking-wider text-content/60 group-hover:text-primary transition-colors">
                                        {linkedTrails.length > 1 ? `Étape ${idx + 1}` : 'Itinéraire'}
                                    </span>
                                </div>
                                <h4 class="text-sm font-semibold truncate text-content group-hover:text-primary transition-colors">
                                    {trail.name || `Trace ${idx + 1}`}
                                </h4>
                                <p class="text-xs text-content/70 flex items-center gap-2">
                                    {#if trail.distance}
                                        <span>{formatDistance(trail.distance, { compact: true })}</span>
                                    {/if}
                                    {#if trail.elevation_gain}
                                        <span>·</span>
                                        <span>+{formatElevation(trail.elevation_gain)} D+</span>
                                    {/if}
                                </p>
                            </div>
                            <div class="w-8 h-8 rounded-lg bg-input-background group-hover:bg-primary group-hover:text-white border border-input-border flex items-center justify-center text-content/60 transition-colors shrink-0">
                                <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                            </div>
                        </a>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Body Copy with PK interactive click listener -->
        {#if article.body}
            <div
                class="article-body prose prose-lg dark:prose-invert max-w-none font-serif leading-relaxed text-content/90"
                onclick={handleBodyClick}
                onkeydown={(e) => { if (e.key === 'Enter') handleBodyClick(e as any); }}
                role="presentation"
            >
                {@html article.body}
            </div>
        {/if}

        <!-- Gallery of Activity Photos & Geotagged Media -->
        {#if aggregatedPhotos.length > 0}
            <div class="space-y-4 pt-8 border-t border-input-border">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="text-xs font-bold uppercase tracking-wider text-primary">Galerie d'expédition</span>
                        <h3 class="text-2xl font-bold font-serif text-content">Photos & Vidéos du parcours</h3>
                    </div>
                    <button
                        type="button"
                        onclick={() => gallery?.openGallery(0)}
                        class="text-xs text-content/70 hover:text-primary transition flex items-center gap-1.5 cursor-pointer font-medium bg-surface/80 hover:bg-surface border border-input-border px-3 py-1.5 rounded-full shadow-2xs"
                    >
                        <i class="fa-solid fa-images text-xs text-primary"></i>
                        <span>{aggregatedPhotos.length} média{aggregatedPhotos.length > 1 ? 's' : ''}</span>
                    </button>
                </div>

                <PhotoGallery
                    photos={aggregatedPhotos.map((p) => p.url)}
                    bind:this={gallery}
                />

                <!-- Wanderer-style Photo Mosaic (up to 3 items: 1 big left, 2 stacked right) -->
                <div
                    class="grid gap-1.5 {aggregatedPhotos.length > 1
                        ? aggregatedPhotos.length === 2
                            ? 'grid-cols-2'
                            : 'grid-cols-[8fr_5fr]'
                        : 'grid-cols-1'} h-72 sm:h-96 rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer shadow-xs border border-input-border/70 bg-neutral-900"
                >
                    {#each aggregatedPhotos.slice(0, 3) as photo, idx}
                        <div
                            class="group relative w-full h-full overflow-hidden bg-neutral-900 select-none {idx === 0 && aggregatedPhotos.length > 2 ? 'row-span-2' : ''}"
                            onclick={() => gallery?.openGallery(idx)}
                            role="button"
                            tabindex="0"
                            onkeydown={(e) => { if (e.key === 'Enter') gallery?.openGallery(idx); }}
                        >
                            {#if isVideoURL(photo.url)}
                                <!-- svelte-ignore a11y_media_has_caption -->
                                <video
                                    controls={false}
                                    loop
                                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    onmouseenter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                                    onmouseleave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
                                    src={photo.url}
                                ></video>
                                <div class="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-40 transition-opacity">
                                    <span class="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-sm shadow-md">
                                        <i class="fa-solid fa-play ml-0.5"></i>
                                    </span>
                                </div>
                            {:else}
                                <img
                                    src={photo.url}
                                    alt={photo.caption || photo.stageLabel}
                                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            {/if}

                            <!-- Badges (Stage & KM) -->
                            <div class="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 flex flex-wrap items-center gap-1 z-10 pointer-events-none">
                                <span class="bg-black/70 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                                    {photo.stageLabel}
                                </span>
                                {#if photo.pkKm !== undefined}
                                    <span class="bg-primary/90 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <i class="fa-solid fa-location-dot text-[7px] sm:text-[8px]"></i>
                                        km {photo.pkKm}
                                    </span>
                                {/if}
                            </div>

                            <!-- "More photos" overlay on the 3rd tile if more than 3 photos exist -->
                            {#if idx === 2 && aggregatedPhotos.length > 3}
                                <div class="absolute inset-0 bg-black/60 hover:bg-black/50 transition-colors flex flex-col items-center justify-center text-white pointer-events-none z-10">
                                    <span class="text-2xl sm:text-3xl font-bold tracking-tight">+{aggregatedPhotos.length - 3}</span>
                                    <span class="text-[11px] sm:text-xs font-semibold uppercase tracking-wider mt-1 text-white/90">Toutes les photos</span>
                                </div>
                            {:else}
                                <!-- Bottom caption & map button (visible on mobile, hover on desktop) -->
                                <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 sm:p-3 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-end justify-between gap-1.5 z-10">
                                    <div class="min-w-0 flex-1">
                                        <p class="text-[11px] sm:text-xs text-white font-medium truncate">{photo.caption}</p>
                                        <span class="text-[9px] sm:text-[10px] text-white/80 hidden sm:inline-flex items-center gap-1 mt-0.5">
                                            <i class="fa-solid fa-expand text-[9px]"></i>
                                            Plein écran
                                        </span>
                                    </div>
                                    {#if photo.lat !== undefined && photo.lon !== undefined}
                                        <button
                                            type="button"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                focusPhotoOnMap(photo);
                                            }}
                                            title="Localiser sur la carte"
                                            class="shrink-0 text-[9px] sm:text-[10px] text-white/90 hover:text-white bg-white/20 hover:bg-primary backdrop-blur-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                                        >
                                            <i class="fa-solid fa-location-dot text-[8px] sm:text-[9px]"></i>
                                            Carte
                                        </button>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>

    <!-- Mobile Backdrop for Drawer -->
    {#if isMapDrawerOpen && !isMapFullscreen}
        <div
            class="fixed inset-0 bg-black/50 backdrop-blur-xs z-30 lg:hidden transition-opacity"
            onclick={closeDrawer}
            role="presentation"
        ></div>
    {/if}

    <!-- Floating Bubble (FAB) when scrolled past map -->
    {#if showFloatingFab && !isMapDrawerOpen && !isMapFullscreen}
        <button
            type="button"
            onclick={() => openDrawer()}
            class="fixed bottom-6 right-6 z-30 flex items-center gap-2.5 px-4 py-3 rounded-full bg-primary text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/20"
            title="Ouvrir la carte de l'itinéraire"
        >
            <i class="fa-solid fa-map text-sm"></i>
            <span class="text-xs font-bold tracking-wide">Carte</span>
            {#if activeKmInfo}
                <span class="bg-black/25 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">{activeKmInfo}</span>
            {/if}
        </button>
    {/if}
</article>

<style>
    :global(.article-body .pk-badge) {
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.65rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 700;
        margin: 0 0.25rem;
        transition: all 0.2s ease;
        text-decoration: none;
        border: 1px solid currentColor;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        vertical-align: baseline;
    }

    :global(.article-body .pk-badge:hover) {
        transform: translateY(-1px);
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.12);
        filter: brightness(1.1);
    }

    :global(.article-body figure[data-layout="full"]) {
        margin: 2.5rem 0;
        width: 100%;
        clear: both;
        text-align: center;
    }
    :global(.article-body figure[data-layout="full"] img),
    :global(.article-body figure[data-layout="full"] video) {
        width: 100%;
        height: auto;
        border-radius: 1.25rem;
        margin: 0 auto;
    }

    :global(.article-body figure[data-layout="center"]) {
        margin: 2rem auto;
        max-width: 42rem;
        clear: both;
        text-align: center;
    }
    :global(.article-body figure[data-layout="center"] img),
    :global(.article-body figure[data-layout="center"] video) {
        max-width: 100%;
        height: auto;
        border-radius: 1.25rem;
        margin: 0 auto;
    }

    :global(.article-body figure[data-layout="left"]) {
        margin: 0.75rem 1.75rem 1.25rem 0;
        max-width: 48%;
        float: left;
        clear: left;
    }
    :global(.article-body figure[data-layout="left"] img),
    :global(.article-body figure[data-layout="left"] video) {
        width: 100%;
        height: auto;
        border-radius: 1rem;
    }

    :global(.article-body figure[data-layout="right"]) {
        margin: 0.75rem 0 1.25rem 1.75rem;
        max-width: 48%;
        float: right;
        clear: right;
    }
    :global(.article-body figure[data-layout="right"] img),
    :global(.article-body figure[data-layout="right"] video) {
        width: 100%;
        height: auto;
        border-radius: 1rem;
    }

    :global(.article-body figcaption) {
        font-size: 0.75rem;
        color: var(--color-muted-foreground, #737373);
        font-style: italic;
        margin-top: 0.375rem;
        text-align: center;
    }

    @media (max-width: 640px) {
        :global(.article-body figure[data-layout="left"]),
        :global(.article-body figure[data-layout="right"]) {
            float: none;
            max-width: 100%;
            margin: 1.75rem 0;
            clear: both;
        }
    }

    :global(.maplibregl-control-container) {
        z-index: 30;
    }
    :global(.maplibregl-popup) {
        z-index: 40 !important;
    }
    :global(.maplibregl-cooperative-gesture-screen) {
        background: rgba(0, 0, 0, 0.4) !important;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 50 !important;
    }
    :global(.maplibregl-cooperative-gesture-screen .maplibregl-desktop-message),
    :global(.maplibregl-cooperative-gesture-screen .maplibregl-mobile-message) {
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.22);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
        padding: 0.75rem 1.5rem;
        border-radius: 9999px;
        font-size: 0.95rem;
        font-weight: 600;
        color: #ffffff;
        text-align: center;
        letter-spacing: 0.01em;
    }
</style>
