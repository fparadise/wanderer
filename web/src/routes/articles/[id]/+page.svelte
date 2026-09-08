<script lang="ts">
    import MapWithElevationMaplibre from "$lib/components/trail/map_with_elevation_maplibre.svelte";
    import { show_toast } from "$lib/stores/toast_store.svelte";
    import { currentUser } from "$lib/stores/user_store";
    import { getFileURL } from "$lib/util/file_util";
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
    import type { ArticleMediaItem } from "$lib/models/article_media";
    import { TRAIL_COLORS } from "$lib/config/map";
    import type { PageData } from "./$types";
    import * as M from "maplibre-gl";
    import { onDestroy } from "svelte";

    let { data }: { data: PageData } = $props();
    let article = $derived(data.article);
    let linkedTrails = $derived(article.expand?.relation || []);
    let author = $derived(article.expand?.author);
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
        popup: M.Popup;
    }

    let map: M.Map | undefined = $state();
    let isMapFullscreen = $state(false);

    function toggleFullscreen() {
        isMapFullscreen = !isMapFullscreen;
        setTimeout(() => {
            map?.resize();
        }, 60);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape" && isMapFullscreen) {
            toggleFullscreen();
        }
    }

    let pkMapItems: PkMapItem[] = [];
    let photoMapItems: PhotoMapItem[] = [];
    let scannedPhotoLocations = $state<Record<string, { lat: number; lon: number; pkKm?: number }>>({});

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

        // 1. Photos from linked trails
        linkedTrails.forEach((t, stageIdx) => {
            const stageLabel = `Étape ${stageIdx + 1}`;
            const points = stageTrackPoints[stageIdx] || [];

            (t.photos || []).forEach((pName, pIdx) => {
                photos.push({
                    id: `${t.id}-photo-${pIdx}`,
                    url: getFileURL(t, pName),
                    sourceTrailId: t.id!,
                    sourceTrailName: t.name,
                    stageIndex: stageIdx,
                    stageLabel,
                    type: "trail_photo",
                    caption: t.name,
                });
            });

            // Waypoint photos
            (t.expand?.waypoints_via_trail || []).forEach((wp) => {
                let pkKm: number | undefined;
                if (wp.lat !== undefined && wp.lon !== undefined && points.length > 0) {
                    const match = findKmForCoordinate(points, wp.lat, wp.lon);
                    if (match) pkKm = match.km;
                }

                (wp.photos || []).forEach((pName, pIdx) => {
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
                    });
                });
            });

            // Summit logs photos
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
                    });
                });
            });
        });

        // 2. Custom uploaded hero images as fallback/complement
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
                });
            });
        }

        return photos.map((p) => {
            if (scannedPhotoLocations[p.id]) {
                return {
                    ...p,
                    lat: scannedPhotoLocations[p.id].lat,
                    lon: scannedPhotoLocations[p.id].lon,
                    pkKm: scannedPhotoLocations[p.id].pkKm ?? p.pkKm,
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

                if (exif.lat !== undefined && exif.lon !== undefined) {
                    matchedLat = exif.lat;
                    matchedLon = exif.lon;
                    if (points.length > 0) {
                        const match = findKmForCoordinate(points, exif.lat, exif.lon);
                        if (match) matchedKm = match.km;
                    }
                } else if (exif.timestamp !== undefined && points.length > 0) {
                    const match = findPointForTimestamp(points, exif.timestamp);
                    if (match) {
                        matchedLat = match.lat;
                        matchedLon = match.lon;
                        matchedKm = match.km;
                    }
                }

                if (matchedLat !== undefined && matchedLon !== undefined) {
                    scannedPhotoLocations = {
                        ...scannedPhotoLocations,
                        [photo.id]: {
                            lat: matchedLat,
                            lon: matchedLon,
                            pkKm: matchedKm,
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

        map.flyTo({
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
            if (item.popup.isOpen()) {
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
                        ${label ? `<p class="text-xs font-semibold text-foreground">${label}</p>` : ''}
                    </div>
                `)
                .addTo(map);
        }

        // Scroll to map smoothly if below viewport
        const mapEl = document.getElementById("article-trail-map");
        if (mapEl) {
            const rect = mapEl.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > window.innerHeight) {
                mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
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
                if (item.popup.isOpen()) {
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
            map.flyTo({ center: [photo.lon, photo.lat], zoom: 15, speed: 1.2 });

            // Close all popups and restore markers
            pkMapItems.forEach((item) => {
                if (item.popup.isOpen()) item.popup.remove();
                item.element.style.opacity = "1";
                item.element.style.visibility = "visible";
                item.element.style.pointerEvents = "auto";
            });
            photoMapItems.forEach((item) => {
                if (item.popup.isOpen()) item.popup.remove();
                item.element.style.opacity = "1";
                item.element.style.visibility = "visible";
                item.element.style.pointerEvents = "auto";
            });

            const existing = photoMapItems.find((item) => item.photoId === photo.id);
            if (existing) {
                if (!existing.popup.isOpen()) {
                    existing.marker.togglePopup();
                }
                existing.element.style.opacity = "0";
                existing.element.style.visibility = "hidden";
                existing.element.style.pointerEvents = "none";
            } else {
                const stageColor = TRAIL_COLORS[photo.stageIndex % TRAIL_COLORS.length];
                new M.Popup({ offset: 12, closeButton: true })
                    .setLngLat([photo.lon, photo.lat])
                    .setHTML(`
                        <div class="p-1.5 space-y-2 max-w-[280px]">
                            <div class="aspect-4/3 w-full rounded-xl overflow-hidden bg-neutral-900 shadow-inner">
                                <img src="${photo.url}" alt="${photo.caption || ''}" class="w-full h-full object-cover" />
                            </div>
                            <div class="space-y-0.5">
                                <div class="font-bold text-xs flex items-center gap-1.5" style="color: ${stageColor}">
                                    <i class="fa-solid fa-camera"></i>
                                    <span>${photo.stageLabel || ''}${photo.pkKm !== undefined ? ` · KM ${photo.pkKm.toFixed(1)}` : ''}</span>
                                </div>
                                ${photo.caption ? `<p class="text-xs font-semibold text-foreground line-clamp-2">${photo.caption}</p>` : ''}
                            </div>
                        </div>
                    `)
                    .addTo(map);
            }

            document.getElementById("article-trail-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
                ${label ? `<p class="text-xs font-semibold text-foreground">${label}</p>` : ''}
                ${quote && quote !== label ? `<p class="text-xs text-muted-foreground italic line-clamp-3 font-serif">"${quote}"</p>` : ''}
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

            const popupContent = document.createElement("div");
            popupContent.className = "p-2 space-y-2 max-w-[340px] sm:max-w-[420px]";

            if (count === 1) {
                popupContent.innerHTML = `
                    <div class="w-full max-h-[360px] flex items-center justify-center rounded-xl overflow-hidden bg-black/5 dark:bg-black/40 shadow-inner">
                        <img src="${coverPhoto.url}" alt="${coverPhoto.caption || ''}" class="max-h-[340px] max-w-full w-auto h-auto object-contain rounded-lg shadow-xs" />
                    </div>
                    <div class="space-y-0.5 pt-0.5">
                        <div class="font-bold text-xs flex items-center gap-1.5" style="color: ${stageColor}">
                            <i class="fa-solid fa-camera"></i>
                            <span>${group.stageLabel || ''}${group.pkKm !== undefined ? ` · KM ${group.pkKm.toFixed(1)}` : ''}</span>
                        </div>
                        ${coverPhoto.caption ? `<p class="text-xs font-semibold text-foreground">${coverPhoto.caption}</p>` : ''}
                    </div>
                `;
            } else {
                const mainImgId = `popup-main-img-${coverPhoto.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                const captionId = `popup-caption-${coverPhoto.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

                const thumbsHtml = group.photos.map((p, idx) => `
                    <button type="button" class="photo-thumb-btn w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${idx === 0 ? 'border-primary ring-2 ring-primary/40' : 'border-transparent opacity-75 hover:opacity-100'}" data-url="${p.url}" data-caption="${p.caption || ''}">
                        <img src="${p.url}" alt="" class="w-full h-full object-cover" />
                    </button>
                `).join("");

                popupContent.innerHTML = `
                    <div class="w-full max-h-[320px] flex items-center justify-center rounded-xl overflow-hidden bg-black/5 dark:bg-black/40 shadow-inner">
                        <img id="${mainImgId}" src="${coverPhoto.url}" alt="${coverPhoto.caption || ''}" class="max-h-[300px] max-w-full w-auto h-auto object-contain rounded-lg shadow-xs transition-all duration-150" />
                    </div>
                    <div class="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
                        ${thumbsHtml}
                    </div>
                    <div class="space-y-0.5 pt-1 border-t border-border">
                        <div class="font-bold text-xs flex items-center justify-between gap-1.5" style="color: ${stageColor}">
                            <div class="flex items-center gap-1.5">
                                <i class="fa-solid fa-camera"></i>
                                <span>${group.stageLabel || ''}${group.pkKm !== undefined ? ` · KM ${group.pkKm.toFixed(1)}` : ''}</span>
                            </div>
                            <span class="text-[10px] text-muted-foreground font-normal">${count} photos</span>
                        </div>
                        <p id="${captionId}" class="text-xs font-medium text-foreground">${coverPhoto.caption || ''}</p>
                    </div>
                `;

                popupContent.querySelectorAll(".photo-thumb-btn").forEach((btn) => {
                    btn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        const url = btn.getAttribute("data-url");
                        const caption = btn.getAttribute("data-caption");
                        const mainImg = popupContent.querySelector(`#${mainImgId}`) as HTMLImageElement;
                        const captionEl = popupContent.querySelector(`#${captionId}`) as HTMLElement;
                        if (mainImg && url) mainImg.src = url;
                        if (captionEl) captionEl.textContent = caption || "";
                        popupContent.querySelectorAll(".photo-thumb-btn").forEach((b) => {
                            b.classList.remove("border-primary", "ring-2", "ring-primary/40");
                            b.classList.add("border-transparent", "opacity-75");
                        });
                        btn.classList.add("border-primary", "ring-2", "ring-primary/40");
                        btn.classList.remove("border-transparent", "opacity-75");
                    });
                });
            }

            const popup = new M.Popup({ offset: 12, closeButton: true, maxWidth: "440px" }).setDOMContent(popupContent);

            // Hide the photo marker when its popup is open, restore when closed
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
                // Close other open popups
                pkMapItems.forEach((item) => {
                    if (item.popup.isOpen()) item.popup.remove();
                });
                photoMapItems.forEach((item) => {
                    if (item.marker !== marker && item.popup.isOpen()) {
                        item.popup.remove();
                    }
                });
                marker.togglePopup();
            });

            const marker = new M.Marker({ element: markerEl, anchor: "center" })
                .setLngLat([group.lon, group.lat])
                .setPopup(popup)
                .addTo(map!);

            photoMapItems.push({ photoId: coverPhoto.id, marker, element: markerEl, popup });
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

<article class="min-h-screen pb-20">
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
                    <h1 class="text-4xl md:text-6xl font-serif font-extrabold text-foreground tracking-tight leading-tight drop-shadow-sm">
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
            <h1 class="text-4xl md:text-5xl font-serif font-extrabold text-foreground tracking-tight">
                {article.title}
            </h1>
        </div>
    {/if}

    <!-- Metadata & Tags Bar -->
    <div class="max-w-5xl mx-auto px-6 py-6 border-b space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-6">
            <!-- Author & Participants -->
            <div class="flex items-center gap-4">
                {#if author}
                    <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-primary shrink-0">
                        <img
                            src={author.icon ? getFileURL(author, author.icon) : `https://api.dicebear.com/7.x/initials/svg?seed=${author.preferred_username || 'A'}`}
                            alt={author.preferred_username || author.username}
                            class="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <p class="text-sm font-bold text-foreground">
                            {author.preferred_username || author.username}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Publié le {new Date(article.date || article.created || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                {/if}

                {#if participants.length > 0}
                    <div class="flex items-center gap-1.5 pl-4 border-l">
                        <span class="text-xs text-muted-foreground mr-1">Avec :</span>
                        {#each participants as p}
                            <span class="text-xs font-medium bg-card border px-2 py-0.5 rounded-full" title={p.preferred_username || p.username}>
                                {p.preferred_username || p.username}
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Stats & Difficulty Badges -->
            <div class="flex flex-wrap items-center gap-3 text-sm font-semibold">
                {#if techDiff}
                    <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border {techDiff.bgColor} {techDiff.borderColor} {techDiff.color} text-xs font-bold shadow-2xs">
                        <i class="fa-solid fa-mountain-city"></i>
                        <span>{techDiff.title}</span>
                    </div>
                {/if}

                {#if article.total_distance > 0}
                    <div class="flex items-center gap-1.5 bg-card border px-3 py-1.5 rounded-xl shadow-xs text-xs font-semibold">
                        <i class="fa-solid fa-route text-primary"></i>
                        <span>{article.total_distance} km</span>
                    </div>
                {/if}
                {#if article.total_elevation_gain > 0}
                    <div class="flex items-center gap-1.5 bg-card border px-3 py-1.5 rounded-xl shadow-xs text-xs font-semibold">
                        <i class="fa-solid fa-mountain text-primary"></i>
                        <span>+{article.total_elevation_gain} m D+</span>
                    </div>
                {/if}
                {#if article.total_days > 0}
                    <div class="flex items-center gap-1.5 bg-card border px-3 py-1.5 rounded-xl shadow-xs text-xs font-semibold">
                        <i class="fa-solid fa-calendar-day text-primary"></i>
                        <span>{article.total_days} {article.total_days > 1 ? 'jours' : 'jour'}</span>
                    </div>
                {/if}

                <!-- Author & Admin Actions -->
                {#if canEdit}
                    <a
                        href="/articles/edit/{article.id}"
                        class="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-xl ml-2 shadow-2xs hover:border-primary/50"
                        title="Modifier l'article"
                    >
                        <i class="fa-solid fa-pen-to-square text-primary text-xs"></i>
                        <span>Modifier</span>
                    </a>
                {/if}
            </div>
        </div>

        <!-- Editorial Tags Pills -->
        {#if tags.length > 0}
            <div class="flex flex-wrap items-center gap-2 pt-2">
                {#each tags as tag}
                    <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                        #{tag}
                    </span>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Main Content Layout -->
    <div class="max-w-4xl mx-auto px-6 pt-12 space-y-12">
        <!-- Chapô -->
        {#if article.intro}
            <div class="text-xl md:text-2xl font-serif italic text-foreground/90 leading-relaxed pl-6 border-l-4 border-primary">
                {article.intro}
            </div>
        {/if}

        <!-- Interactive Map of Linked Trails -->
        {#if linkedTrails.length > 0}
            <div class="space-y-4">
                <div
                    id="article-trail-map"
                    class="{isMapFullscreen
                        ? 'fixed inset-0 z-50 w-screen h-screen rounded-none bg-background'
                        : 'w-full h-[520px] rounded-2xl overflow-hidden border shadow-sm relative'}"
                >
                    {#if isMapFullscreen}
                        <button
                            type="button"
                            onclick={toggleFullscreen}
                            class="absolute top-4 left-4 z-20 px-3.5 py-2 rounded-xl bg-card/90 backdrop-blur-sm border shadow-lg text-xs font-bold hover:bg-primary hover:text-white transition-all flex items-center gap-2"
                        >
                            <i class="fa-solid fa-compress"></i>
                            Quitter le plein écran
                        </button>
                    {/if}

                    <MapWithElevationMaplibre
                        bind:map
                        trails={linkedTrails}
                        showElevation={true}
                        showFullscreen={true}
                        onfullscreen={toggleFullscreen}
                        showStyleSwitcher={true}
                        fitAllTrails={true}
                    />
                </div>

                <!-- Simple list of cards linking to each route / trail page -->
                <div class="grid grid-cols-1 sm:grid-cols-2 {linkedTrails.length > 2 ? 'md:grid-cols-3' : ''} gap-3">
                    {#each linkedTrails as trail, idx}
                        {@const stageColor = TRAIL_COLORS[idx % TRAIL_COLORS.length]}
                        {@const authorName = trail.expand?.author?.preferred_username || trail.expand?.author?.username || trail.author || '_'}
                        <a
                            href="/trail/view/@{authorName}/{trail.id}"
                            class="group p-3.5 rounded-xl border bg-card hover:border-primary/60 transition-all shadow-2xs hover:shadow-xs flex items-center justify-between gap-3"
                        >
                            <div class="min-w-0 flex-1 space-y-1">
                                <div class="flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {stageColor};"></span>
                                    <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
                                        {linkedTrails.length > 1 ? `Étape ${idx + 1}` : 'Itinéraire'}
                                    </span>
                                </div>
                                <h4 class="text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                                    {trail.name || `Trace ${idx + 1}`}
                                </h4>
                                <p class="text-xs text-muted-foreground flex items-center gap-2">
                                    {#if trail.distance}
                                        <span>{((trail.distance || 0) / 1000).toFixed(1)} km</span>
                                    {/if}
                                    {#if trail.elevation_gain}
                                        <span>·</span>
                                        <span>+{Math.round(trail.elevation_gain || 0)} m D+</span>
                                    {/if}
                                </p>
                            </div>
                            <div class="w-8 h-8 rounded-lg bg-card group-hover:bg-primary group-hover:text-white border flex items-center justify-center text-muted-foreground transition-colors shrink-0">
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
                class="article-body prose prose-lg dark:prose-invert max-w-none font-serif leading-relaxed text-foreground/90"
                onclick={handleBodyClick}
                onkeydown={(e) => { if (e.key === 'Enter') handleBodyClick(e as any); }}
                role="presentation"
            >
                {@html article.body}
            </div>
        {/if}

        <!-- Gallery of Activity Photos & Geotagged Media -->
        {#if aggregatedPhotos.length > 0}
            <div class="space-y-4 pt-8 border-t">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="text-xs font-bold uppercase tracking-wider text-primary">Galerie d'expédition</span>
                        <h3 class="text-2xl font-bold font-serif text-foreground">Photos de l'itinéraire</h3>
                    </div>
                    <span class="text-xs text-muted-foreground">
                        {aggregatedPhotos.length} photos disponibles
                    </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {#each aggregatedPhotos as photo}
                        <div
                            class="group relative aspect-4/3 rounded-2xl overflow-hidden border shadow-xs bg-neutral-900 cursor-pointer"
                            onclick={() => focusPhotoOnMap(photo)}
                            role="button"
                            tabindex="0"
                            onkeydown={(e) => { if (e.key === 'Enter') focusPhotoOnMap(photo); }}
                        >
                            <img
                                src={photo.url}
                                alt={photo.caption || photo.stageLabel}
                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />

                            <!-- Top Badges -->
                            <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                                <span class="bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {photo.stageLabel}
                                </span>
                                {#if photo.pkKm !== undefined}
                                    <span class="bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <i class="fa-solid fa-location-dot text-[8px]"></i>
                                        km {photo.pkKm}
                                    </span>
                                {/if}
                            </div>

                            <!-- Bottom caption on hover -->
                            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p class="text-xs text-white font-medium truncate">{photo.caption}</p>
                                <span class="text-[10px] text-white/80 inline-flex items-center gap-1 mt-0.5">
                                    <i class="fa-solid fa-magnifying-glass-location"></i>
                                    Localiser sur la carte
                                </span>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
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
    :global(.article-body figure[data-layout="full"] img) {
        width: 100%;
        max-height: 600px;
        object-fit: cover;
        border-radius: 1.25rem;
        margin: 0 auto;
    }

    :global(.article-body figure[data-layout="center"]) {
        margin: 2rem auto;
        max-width: 42rem;
        clear: both;
        text-align: center;
    }
    :global(.article-body figure[data-layout="center"] img) {
        max-height: 520px;
        object-fit: cover;
        border-radius: 1.25rem;
        margin: 0 auto;
    }

    :global(.article-body figure[data-layout="left"]) {
        margin: 0.75rem 1.75rem 1.25rem 0;
        max-width: 48%;
        float: left;
        clear: left;
    }
    :global(.article-body figure[data-layout="left"] img) {
        width: 100%;
        border-radius: 1rem;
    }

    :global(.article-body figure[data-layout="right"]) {
        margin: 0.75rem 0 1.25rem 1.75rem;
        max-width: 48%;
        float: right;
        clear: right;
    }
    :global(.article-body figure[data-layout="right"] img) {
        width: 100%;
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
</style>
