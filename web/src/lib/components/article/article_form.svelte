<script lang="ts">
    import { goto } from "$app/navigation";
    import Editor from "$lib/components/base/editor.svelte";
    import TrailPicker from "$lib/components/article/trail_picker.svelte";
    import type { Article } from "$lib/models/article";
    import type { Trail } from "$lib/models/trail";
    import { trails_show } from "$lib/stores/trail_store";
    import { show_toast } from "$lib/stores/toast_store.svelte";
    import { getFileURL } from "$lib/util/file_util";
    import {
        EDITORIAL_TAG_CATEGORIES,
        TECHNICAL_DIFFICULTY_LEVELS,
        type TechnicalDifficultyLevel,
    } from "$lib/models/editorial_tags";
    import {
        type ArticleMediaItem,
        extractBaseFileName,
        deduplicateGroupPhotos,
    } from "$lib/models/article_media";
    import { onMount } from "svelte";

    interface Props {
        mode: "create" | "edit";
        initialArticle?: Article;
        onsubmit: (
            data: Partial<Article>,
            heroFiles: File[],
            deletedHeroImages: string[]
        ) => Promise<void>;
        ondelete?: () => Promise<void>;
    }

    let { mode, initialArticle, onsubmit, ondelete }: Props = $props();

    let title: string = $state(initialArticle?.title || "");
    let intro: string = $state(initialArticle?.intro || "");
    let body: string = $state(initialArticle?.body || "");
    let totalDistance: number = $state(initialArticle?.total_distance ?? 0);
    let totalElevationGain: number = $state(initialArticle?.total_elevation_gain ?? 0);
    let totalDays: number = $state(initialArticle?.total_days ?? 1);
    let date: string = $state(
        initialArticle?.date || new Date().toISOString().substring(0, 10)
    );
    let technicalDifficulty: number = $state(initialArticle?.technical_difficulty ?? 0);
    let selectedTags: string[] = $state(
        initialArticle?.tags ? [...initialArticle.tags] : []
    );
    let customTagInput: string = $state("");

    let selectedTrailIds: string[] = $state(
        initialArticle?.relation ? [...initialArticle.relation] : []
    );
    let loadedTrails: Trail[] = $state(initialArticle?.expand?.relation || []);
    let activityPhotos: ArticleMediaItem[] = $state([]);

    // Hero images management
    let rawHeroImages: string[] = $state(
        initialArticle?.hero_images ? [...initialArticle.hero_images] : []
    );
    let deletedHeroImages: string[] = $state([]);
    let heroFiles: File[] = $state([]);
    let heroPreviews: string[] = $state([]);

    let submitting: boolean = $state(false);
    let deleting: boolean = $state(false);
    let showDeleteConfirm: boolean = $state(false);

    let editorComponent: any = $state();
    let draggedPhotoIdx: number | null = $state(null);

    onMount(() => {
        if (loadedTrails.length > 0) {
            extractActivityPhotos(loadedTrails);
        }
    });

    async function handleTrailsChange(selectedTrails: Trail[]) {
        if (selectedTrails.length > 0) {
            const sumDistanceKm = Math.round(
                selectedTrails.reduce((sum, t) => sum + (t.distance || 0), 0) / 1000
            );
            const sumElevationM = Math.round(
                selectedTrails.reduce((sum, t) => sum + (t.elevation_gain || 0), 0)
            );
            totalDistance = sumDistanceKm;
            totalElevationGain = sumElevationM;
            if (totalDays < selectedTrails.length) {
                totalDays = selectedTrails.length;
            }

            // Load full trail details for each selected trail
            const fullTrails = await Promise.all(
                selectedTrails.map(async (st) => {
                    try {
                        return await trails_show(st.id!, undefined, undefined, false);
                    } catch {
                        return st;
                    }
                })
            );
            loadedTrails = fullTrails;
            selectedTrailIds = fullTrails.map((t) => t.id!);
            extractActivityPhotos(fullTrails);
        } else {
            loadedTrails = [];
            activityPhotos = [];
        }
    }

    function extractActivityPhotos(trails: Trail[]) {
        const photos: ArticleMediaItem[] = [];
        trails.forEach((t, stageIdx) => {
            const stageLabel = `Étape ${stageIdx + 1}`;

            // 1. Waypoint photos first (richest metadata: POI name & coordinates)
            const knownWaypointNames = new Set<string>();
            const knownWaypointBaseNames = new Set<string>();

            (t.expand?.waypoints_via_trail || []).forEach((wp) => {
                (wp.photos || []).forEach((pName, pIdx) => {
                    knownWaypointNames.add(pName);
                    const base = extractBaseFileName(pName);
                    const nameWithoutExt = base.replace(/\.[^.]+$/, "");
                    if (nameWithoutExt.length >= 3) {
                        knownWaypointBaseNames.add(base);
                    }

                    photos.push({
                        id: `${wp.id}-wp-photo-${pIdx}`,
                        url: getFileURL(wp, pName),
                        sourceTrailId: t.id!,
                        sourceTrailName: t.name,
                        stageIndex: stageIdx,
                        stageLabel,
                        lat: wp.lat,
                        lon: wp.lon,
                        type: "waypoint_photo",
                        caption: wp.name || t.name,
                        fileName: pName,
                    });
                });
            });

            // 2. Trail photos (skip duplicates already covered in waypoints)
            (t.photos || []).forEach((pName, pIdx) => {
                const base = extractBaseFileName(pName);
                const nameWithoutExt = base.replace(/\.[^.]+$/, "");
                const isDuplicate =
                    knownWaypointNames.has(pName) ||
                    (nameWithoutExt.length >= 3 && knownWaypointBaseNames.has(base));
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
                        id: `${log.id}-log-photo-${pIdx}`,
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
        activityPhotos = deduplicateGroupPhotos(photos);
    }

    function handleDragStart(idx: number) {
        draggedPhotoIdx = idx;
    }

    function handleDragOver(e: DragEvent, targetIdx: number) {
        e.preventDefault();
        if (draggedPhotoIdx === null || draggedPhotoIdx === targetIdx) return;
        const items = [...activityPhotos];
        const draggedItem = items.splice(draggedPhotoIdx, 1)[0];
        items.splice(targetIdx, 0, draggedItem);
        draggedPhotoIdx = targetIdx;
        activityPhotos = items;
    }

    function handleDragEnd() {
        draggedPhotoIdx = null;
    }

    function removeActivityPhoto(index: number) {
        activityPhotos = activityPhotos.filter((_, i) => i !== index);
    }

    async function setAsCover(photo: ArticleMediaItem) {
        try {
            const res = await fetch(photo.url);
            const blob = await res.blob();
            const file = new File([blob], `cover-${photo.id}.jpg`, {
                type: blob.type || "image/jpeg",
            });
            heroFiles = [file, ...heroFiles];
            heroPreviews = [photo.url, ...heroPreviews];
            show_toast({ type: "success", icon: "check", text: "Photo ajoutée comme couverture !" });
        } catch (e) {
            console.error(e);
            show_toast({ type: "error", icon: "close", text: "Erreur lors de la sélection de la couverture." });
        }
    }

    function insertPhotoInText(photo: ArticleMediaItem) {
        if (!editorComponent) return;
        editorComponent.insertImage(
            photo.url,
            photo.caption || photo.sourceTrailName,
            photo.caption || photo.stageLabel
        );
        show_toast({ type: "info", icon: "check", text: "Photo insérée dans le texte !" });
    }

    function handleFileSelect(e: Event) {
        const input = e.target as HTMLInputElement;
        if (!input.files) return;
        const files = Array.from(input.files);
        heroFiles = [...heroFiles, ...files];

        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    heroPreviews = [...heroPreviews, event.target.result as string];
                }
            };
            reader.readAsDataURL(file);
        }
    }

    function removeNewHeroImage(index: number) {
        heroFiles = heroFiles.filter((_, i) => i !== index);
        heroPreviews = heroPreviews.filter((_, i) => i !== index);
    }

    function removeExistingHeroImage(imgName: string) {
        deletedHeroImages = [...deletedHeroImages, imgName];
        rawHeroImages = rawHeroImages.filter((name) => name !== imgName);
    }

    function toggleTag(tag: string) {
        if (selectedTags.includes(tag)) {
            selectedTags = selectedTags.filter((t) => t !== tag);
        } else {
            selectedTags = [...selectedTags, tag];
        }
    }

    function addCustomTag() {
        const trimmed = customTagInput.trim();
        if (!trimmed) return;
        if (!selectedTags.includes(trimmed)) {
            selectedTags = [...selectedTags, trimmed];
        }
        customTagInput = "";
    }

    function removeTag(tag: string) {
        selectedTags = selectedTags.filter((t) => t !== tag);
    }

    async function handleFormSubmit() {
        if (!title.trim()) {
            show_toast({ type: "error", icon: "close", text: "Veuillez donner un titre à votre article." });
            return;
        }

        const currentBody = editorComponent?.getHTML ? editorComponent.getHTML() : body;

        submitting = true;
        try {
            await onsubmit(
                {
                    title,
                    intro,
                    body: currentBody,
                    total_distance: totalDistance,
                    total_elevation_gain: totalElevationGain,
                    total_days: totalDays,
                    date,
                    relation: selectedTrailIds,
                    tags: selectedTags,
                    technical_difficulty: technicalDifficulty,
                },
                heroFiles,
                deletedHeroImages
            );
        } catch (e: any) {
            console.error(e);
            let errorMsg = e.message || "Erreur lors de l'enregistrement.";
            if (e.detail && typeof e.detail === "object") {
                const fieldErrors = Object.entries(e.detail)
                    .map(
                        ([field, err]: [string, any]) =>
                            `${field}: ${typeof err === "object" ? err.message || JSON.stringify(err) : err}`
                    )
                    .join(", ");
                if (fieldErrors) errorMsg += ` (${fieldErrors})`;
            }
            show_toast({ type: "error", icon: "close", text: errorMsg });
        } finally {
            submitting = false;
        }
    }

    async function handleFormDelete() {
        if (!ondelete) return;
        deleting = true;
        try {
            await ondelete();
        } catch (e: any) {
            console.error(e);
            show_toast({ type: "error", icon: "close", text: e.message || "Erreur lors de la suppression." });
        } finally {
            deleting = false;
            showDeleteConfirm = false;
        }
    }

    const cancelHref = $derived(
        mode === "edit" && initialArticle ? `/articles/${initialArticle.id}` : "/articles"
    );
</script>

<div class="max-w-6xl mx-auto px-4 py-8 space-y-8">
    <!-- Top Header Bar -->
    <div class="flex items-center justify-between pb-6 border-b">
        <div class="flex items-center gap-4">
            <a href={cancelHref} class="btn-icon text-content/60 hover:text-content" title="Retour">
                <i class="fa-solid fa-arrow-left"></i>
            </a>
            <div>
                <span class="text-xs uppercase font-bold tracking-widest text-primary">
                    {mode === "edit" ? "Édition du carnet" : "Studio Magazine"}
                </span>
                <h1 class="text-3xl font-serif font-bold text-content">
                    {mode === "edit" ? "Modifier le récit" : "Rédiger un nouveau récit"}
                </h1>
            </div>
        </div>
        <div class="flex items-center gap-3">
            <a href={cancelHref} class="btn-secondary text-sm">Annuler</a>
            <button
                type="button"
                onclick={handleFormSubmit}
                disabled={submitting}
                class="btn-primary flex items-center gap-2 text-sm shadow-xs"
            >
                {#if submitting}
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Enregistrement...</span>
                {:else}
                    <i class="fa-solid {mode === 'edit' ? 'fa-floppy-disk' : 'fa-paper-plane'}"></i>
                    <span>{mode === "edit" ? "Enregistrer les modifications" : "Publier le récit"}</span>
                {/if}
            </button>
        </div>
    </div>

    <!-- Main Two-Column Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Left Main Column (2 cols) -->
        <div class="lg:col-span-2 space-y-8">
            <!-- Title -->
            <div class="space-y-2">
                <label for="article-title" class="block text-xs uppercase font-bold tracking-wider text-content/70">
                    Titre du récit *
                </label>
                <input
                    id="article-title"
                    type="text"
                    bind:value={title}
                    placeholder="Ex: 4 jours en autonomie dans les grands espaces..."
                    class="w-full text-2xl font-serif font-semibold px-4 py-3 rounded-xl border border-input-border bg-background text-content focus:ring-2 focus:ring-primary focus:outline-hidden transition-all"
                />
            </div>

            <!-- Chapô / Intro -->
            <div class="space-y-2">
                <label for="article-intro" class="block text-xs uppercase font-bold tracking-wider text-content/70">
                    Chapô d'introduction (résumé d'accroche)
                </label>
                <textarea
                    id="article-intro"
                    bind:value={intro}
                    rows="3"
                    placeholder="Une courte introduction évocatrice pour plonger le lecteur dans l'ambiance de l'aventure..."
                    class="w-full text-base px-4 py-3 rounded-xl border border-input-border bg-background text-content focus:ring-2 focus:ring-primary focus:outline-hidden transition-all italic"
                ></textarea>
            </div>

            <!-- Hero Images Upload Area -->
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <label class="block text-xs uppercase font-bold tracking-wider text-content/70">
                        Photos de couverture & galerie hero
                    </label>
                    <span class="text-xs text-content/60">
                        {rawHeroImages.length + heroPreviews.length} photo(s)
                    </span>
                </div>

                <div class="border-2 border-dashed border-input-border rounded-2xl p-6 text-center hover:border-primary/60 transition-colors bg-input-background/40">
                    <!-- Existing + New Previews -->
                    {#if rawHeroImages.length > 0 || heroPreviews.length > 0}
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                            <!-- Existing stored images -->
                            {#each rawHeroImages as imgName, idx}
                                {@const imgUrl = initialArticle ? getFileURL(initialArticle, imgName) : ""}
                                <div class="relative aspect-video rounded-xl overflow-hidden border shadow-xs group bg-neutral-900">
                                    <img src={imgUrl} alt="Photo existante" class="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onclick={() => removeExistingHeroImage(imgName)}
                                        class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                        title="Supprimer cette photo"
                                    >
                                        <i class="fa-solid fa-xmark text-xs"></i>
                                    </button>
                                    {#if idx === 0 && heroPreviews.length === 0}
                                        <span class="absolute bottom-2 left-2 text-[10px] uppercase font-bold bg-primary text-white px-2 py-0.5 rounded-sm">
                                            Couverture
                                        </span>
                                    {/if}
                                </div>
                            {/each}

                            <!-- Newly selected images -->
                            {#each heroPreviews as preview, idx}
                                <div class="relative aspect-video rounded-xl overflow-hidden border shadow-xs group bg-neutral-900">
                                    <img src={preview} alt="Nouvel aperçu" class="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onclick={() => removeNewHeroImage(idx)}
                                        class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                        title="Retirer"
                                    >
                                        <i class="fa-solid fa-xmark text-xs"></i>
                                    </button>
                                    {#if rawHeroImages.length === 0 && idx === 0}
                                        <span class="absolute bottom-2 left-2 text-[10px] uppercase font-bold bg-primary text-white px-2 py-0.5 rounded-sm">
                                            Couverture
                                        </span>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}

                    <label class="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/40 text-primary font-medium hover:bg-primary/10 transition-colors">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        <span>
                            {rawHeroImages.length > 0 || heroPreviews.length > 0
                                ? "Ajouter d'autres photos"
                                : "Téléverser des photos (JPG, PNG, WebP)"}
                        </span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onchange={handleFileSelect}
                            class="hidden"
                        />
                    </label>
                    <p class="text-xs text-content/60 mt-2">
                        La première photo servira de couverture principale en haut de l'article.
                    </p>
                </div>
            </div>

            <!-- Activity Photos Tray (Media Items from linked trails) -->
            {#if activityPhotos.length > 0}
                <div class="space-y-3 p-5 rounded-2xl border border-input-border bg-input-background/40 shadow-xs">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-serif font-bold text-base text-content flex items-center gap-2">
                                <i class="fa-solid fa-images text-primary"></i>
                                Médiathèque des traces associées ({activityPhotos.length})
                            </h3>
                            <p class="text-xs text-content/70 mt-0.5">
                                Glissez-déposez pour réorganiser l'ordre, insérez dans le texte ou définissez comme couverture.
                            </p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                        {#each activityPhotos as photo, idx}
                            <div
                                draggable="true"
                                role="listitem"
                                ondragstart={() => handleDragStart(idx)}
                                ondragover={(e) => handleDragOver(e, idx)}
                                ondragend={handleDragEnd}
                                class="group relative aspect-square rounded-xl overflow-hidden border border-input-border bg-neutral-900 shadow-2xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all select-none {draggedPhotoIdx === idx ? 'opacity-40 ring-2 ring-primary scale-95' : ''}"
                            >
                                <img
                                    src={photo.url}
                                    alt={photo.caption || photo.sourceTrailName}
                                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                                />

                                <div class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[10px] font-bold text-white shadow-xs">
                                    #{idx + 1}
                                </div>

                                <button
                                    type="button"
                                    onclick={() => removeActivityPhoto(idx)}
                                    title="Retirer"
                                    class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all shadow-xs z-10"
                                >
                                    <i class="fa-solid fa-xmark"></i>
                                </button>

                                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 gap-1.5">
                                    <span class="text-[10px] text-white/90 truncate font-semibold">
                                        {photo.stageLabel}
                                    </span>
                                    <div class="flex items-center gap-1 pt-1 border-t border-white/20">
                                        <button
                                            type="button"
                                            onclick={() => insertPhotoInText(photo)}
                                            title="Insérer dans le corps du texte"
                                            class="flex-1 py-1 rounded bg-white text-black hover:bg-neutral-200 text-[10px] font-bold text-center flex items-center justify-center gap-1"
                                        >
                                            <i class="fa-solid fa-feather-pointed"></i> Insérer
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() => setAsCover(photo)}
                                            title="Définir en couverture"
                                            class="p-1 rounded bg-black/60 text-white hover:bg-primary text-[10px] aspect-square flex items-center justify-center"
                                        >
                                            <i class="fa-solid fa-star"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Body / Rich Text Editor -->
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <label class="block text-xs uppercase font-bold tracking-wider text-content/70">
                        Corps du récit
                    </label>
                </div>

                <div class="border border-input-border rounded-2xl bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary">
                    <Editor
                        bind:this={editorComponent}
                        bind:value={body}
                        mediaItems={activityPhotos}
                        trails={loadedTrails}
                        placeholder="Racontez votre expérience, partagez vos impressions, les conditions de sentier, les moments forts..."
                        extraClasses="min-h-[400px] p-4 prose dark:prose-invert max-w-none focus:outline-hidden"
                    />
                </div>
            </div>

            <!-- Editorial Tags Selector -->
            <div class="space-y-4 p-5 rounded-2xl border border-input-border bg-input-background/40 shadow-xs">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="font-serif font-bold text-base text-content flex items-center gap-2">
                            <i class="fa-solid fa-tags text-primary"></i>
                            Étiquettes & Ambiance éditoriale
                        </h3>
                        <p class="text-xs text-content/70 mt-0.5">
                            Sélectionnez les tags qui caractérisent votre aventure pour guider les lecteurs.
                        </p>
                    </div>
                </div>

                <!-- Active tags badges -->
                {#if selectedTags.length > 0}
                    <div class="flex flex-wrap gap-1.5 p-3 bg-background border border-input-border rounded-xl">
                        {#each selectedTags as tag}
                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                #{tag}
                                <button
                                    type="button"
                                    onclick={() => removeTag(tag)}
                                    class="hover:text-red-500 transition-colors ml-0.5"
                                    title="Retirer le tag"
                                >
                                    <i class="fa-solid fa-xmark text-[10px]"></i>
                                </button>
                            </span>
                        {/each}
                    </div>
                {/if}

                <!-- Preset Categories -->
                <div class="space-y-3">
                    {#each EDITORIAL_TAG_CATEGORIES as category}
                        <div class="space-y-1.5">
                            <span class="text-[11px] font-bold uppercase tracking-wider text-content/70">
                                {category.label}
                            </span>
                            <div class="flex flex-wrap gap-1.5">
                                {#each category.tags as tag}
                                    {@const isSelected = selectedTags.includes(tag)}
                                    <button
                                        type="button"
                                        onclick={() => toggleTag(tag)}
                                        class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-150 {isSelected ? 'bg-primary text-white border-primary shadow-2xs font-semibold' : 'bg-background hover:bg-input-background hover:border-primary/50 text-content border-input-border'}"
                                    >
                                        #{tag}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Custom tag input -->
                <div class="flex items-center gap-2 pt-2 border-t border-input-border">
                    <input
                        type="text"
                        bind:value={customTagInput}
                        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
                        placeholder="Ajouter un tag personnalisé (ex: coucher-de-soleil)..."
                        class="flex-1 px-3 py-2 text-xs rounded-xl border border-input-border bg-background text-content focus:ring-1 focus:ring-primary focus:outline-hidden"
                    />
                    <button
                        type="button"
                        onclick={addCustomTag}
                        class="px-4 py-2 text-xs font-semibold rounded-xl bg-background hover:bg-input-background border border-input-border transition-colors text-content"
                    >
                        Ajouter
                    </button>
                </div>
            </div>
        </div>

        <!-- Right Sidebar Column (1 col) -->
        <div class="space-y-6">
            <!-- Trail Association Widget -->
            <div class="bg-background border border-input-border rounded-2xl p-5 shadow-xs">
                <TrailPicker
                    bind:selectedIds={selectedTrailIds}
                    onchange={handleTrailsChange}
                />
            </div>

            <!-- Voyage Metrics -->
            <div class="bg-background border border-input-border rounded-2xl p-5 shadow-xs space-y-4">
                <h3 class="text-xs uppercase font-bold tracking-wider text-content/70">
                    Données globales du voyage
                </h3>

                <div>
                    <label for="metric-distance" class="block text-xs text-content/70 mb-1">
                        Distance totale (km)
                    </label>
                    <div class="relative">
                        <input
                            id="metric-distance"
                            type="number"
                            step="1"
                            bind:value={totalDistance}
                            class="w-full px-3 py-2 rounded-xl border bg-background text-sm font-semibold"
                        />
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content/70">km</span>
                    </div>
                </div>

                <div>
                    <label for="metric-elevation" class="block text-xs text-content/70 mb-1">
                        Dénivelé positif (m D+)
                    </label>
                    <div class="relative">
                        <input
                            id="metric-elevation"
                            type="number"
                            step="10"
                            bind:value={totalElevationGain}
                            class="w-full px-3 py-2 rounded-xl border border-input-border bg-background text-sm font-semibold"
                        />
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content/70">m</span>
                    </div>
                </div>

                <div>
                    <label for="metric-days" class="block text-xs text-content/70 mb-1">
                        Durée (nombre de jours)
                    </label>
                    <div class="relative">
                        <input
                            id="metric-days"
                            type="number"
                            min="1"
                            bind:value={totalDays}
                            class="w-full px-3 py-2 rounded-xl border border-input-border bg-background text-sm font-semibold"
                        />
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content/70">jours</span>
                    </div>
                </div>

                <div>
                    <label for="metric-date" class="block text-xs text-content/70 mb-1">
                        Date de l'expédition
                    </label>
                    <input
                        id="metric-date"
                        type="date"
                        bind:value={date}
                        class="w-full px-3 py-2 rounded-xl border border-input-border bg-background text-sm"
                    />
                </div>

                <!-- Technical Difficulty Selector -->
                <div class="pt-2 border-t border-input-border space-y-2">
                    <div class="flex items-center justify-between">
                        <label class="block text-xs text-content/70">Niveau technique</label>
                        <span class="text-xs font-bold text-primary">
                            {technicalDifficulty > 0
                                ? TECHNICAL_DIFFICULTY_LEVELS[technicalDifficulty]?.title || `Niveau ${technicalDifficulty}`
                                : "Non spécifié"}
                        </span>
                    </div>
                    <div class="grid grid-cols-6 gap-1">
                        <button
                            type="button"
                            onclick={() => (technicalDifficulty = 0)}
                            title="Non spécifié"
                            class="py-1.5 rounded-lg border text-xs font-bold transition-all {technicalDifficulty === 0 ? 'bg-primary text-white border-primary shadow-xs' : 'bg-background hover:bg-input-background border-input-border text-content/70'}"
                        >
                            —
                        </button>
                        {#each Object.values(TECHNICAL_DIFFICULTY_LEVELS) as diff}
                            <button
                                type="button"
                                onclick={() => (technicalDifficulty = diff.level)}
                                title={`${diff.title} : ${diff.subtitle}`}
                                class="py-1.5 rounded-lg border text-xs font-bold transition-all {technicalDifficulty === diff.level ? 'bg-primary text-white border-primary shadow-xs' : 'bg-background hover:bg-input-background border-input-border text-content/70'}"
                            >
                                {diff.level}
                            </button>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Publishing Actions Card -->
            <div class="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-3 shadow-xs">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                        <i class="fa-solid {mode === 'edit' ? 'fa-pen-to-square' : 'fa-feather'}"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-content">
                            {mode === "edit" ? "Mise à jour du récit" : "Publication ouverte"}
                        </p>
                        <p class="text-[11px] text-content/70">
                            {mode === "edit" ? "Les modifications seront visibles immédiatement." : "Votre récit sera visible dans la galerie Magazine."}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onclick={handleFormSubmit}
                    disabled={submitting}
                    class="w-full btn-primary py-3 flex items-center justify-center gap-2 font-semibold shadow-xs"
                >
                    {#if submitting}
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <span>Enregistrement...</span>
                    {:else}
                        <i class="fa-solid {mode === 'edit' ? 'fa-floppy-disk' : 'fa-check'}"></i>
                        <span>{mode === "edit" ? "Enregistrer les modifications" : "Enregistrer et publier"}</span>
                    {/if}
                </button>

                {#if mode === "edit" && ondelete}
                    <div class="pt-2 border-t border-input-border/40">
                        <button
                            type="button"
                            onclick={() => (showDeleteConfirm = true)}
                            class="w-full py-2 px-3 text-xs text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded-xl transition-colors flex items-center justify-center gap-1.5 font-medium"
                        >
                            <i class="fa-solid fa-trash-can"></i>
                            <span>Supprimer définitivement cet article</span>
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
    <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-background border border-input-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div class="flex items-center gap-3 text-red-500">
                <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                    <i class="fa-solid fa-triangle-exclamation text-lg"></i>
                </div>
                <h3 class="text-lg font-bold text-content">Supprimer le récit ?</h3>
            </div>
            <p class="text-sm text-content/70">
                Êtes-vous sûr de vouloir supprimer définitivement ce récit ? Cette action est irréversible et retirera l'article de la galerie.
            </p>
            <div class="flex items-center justify-end gap-3 pt-2">
                <button
                    type="button"
                    onclick={() => (showDeleteConfirm = false)}
                    class="btn-secondary text-xs py-2 px-4 rounded-xl"
                >
                    Annuler
                </button>
                <button
                    type="button"
                    onclick={handleFormDelete}
                    disabled={deleting}
                    class="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-2 shadow-xs"
                >
                    {#if deleting}
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        Suppression...
                    {:else}
                        <i class="fa-solid fa-trash-can"></i>
                        Confirmer la suppression
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}
