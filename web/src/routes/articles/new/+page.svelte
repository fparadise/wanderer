<script lang="ts">
    import { goto } from "$app/navigation";
    import Editor from "$lib/components/base/editor.svelte";
    import TrailPicker from "$lib/components/article/trail_picker.svelte";
    import type { Trail } from "$lib/models/trail";
    import { articles_create } from "$lib/stores/article_store";
    import { trails_show } from "$lib/stores/trail_store";
    import { show_toast } from "$lib/stores/toast_store.svelte";
    import { currentUser } from "$lib/stores/user_store";
    import { getFileURL } from "$lib/util/file_util";
    import {
        EDITORIAL_TAG_CATEGORIES,
        TECHNICAL_DIFFICULTY_LEVELS,
        type TechnicalDifficultyLevel,
    } from "$lib/models/editorial_tags";
    import type { ArticleMediaItem } from "$lib/models/article_media";
    import { _ } from "svelte-i18n";

    let title: string = $state("");
    let intro: string = $state("");
    let body: string = $state("");
    let totalDistance: number = $state(0);
    let totalElevationGain: number = $state(0);
    let totalDays: number = $state(1);
    let date: string = $state(new Date().toISOString().substring(0, 10));
    let technicalDifficulty: number = $state(0);
    let selectedTags: string[] = $state([]);
    let customTagInput: string = $state("");

    let selectedTrailIds: string[] = $state([]);
    let loadedTrails: Trail[] = $state([]);
    let activityPhotos: ArticleMediaItem[] = $state([]);
    let heroFiles: File[] = $state([]);
    let heroPreviews: string[] = $state([]);
    let submitting: boolean = $state(false);

    let editorComponent: any = $state();

    // Drag and drop state for photos
    let draggedPhotoIdx: number | null = $state(null);

    function removeActivityPhoto(index: number) {
        activityPhotos = activityPhotos.filter((_, i) => i !== index);
    }

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

            // Load full trail details for each selected trail to get waypoints & photos
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
            // 1. Trail photos
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

            // 2. Waypoints photos
            (t.expand?.waypoints_via_trail || []).forEach((wp) => {
                (wp.photos || []).forEach((pName, pIdx) => {
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
                    });
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
                    });
                });
            });
        });
        activityPhotos = photos;
    }

    // Drag and drop photo reordering
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

    async function setAsCover(photo: ArticleMediaItem) {
        try {
            // Fetch blob from URL to create a file
            const res = await fetch(photo.url);
            const blob = await res.blob();
            const file = new File([blob], `cover-${photo.id}.jpg`, { type: blob.type || "image/jpeg" });
            heroFiles = [file, ...heroFiles.slice(1)];
            heroPreviews = [photo.url, ...heroPreviews.slice(1)];
            show_toast({ type: "success", icon: "check", text: "Photo définie comme couverture !" });
        } catch (e) {
            console.error(e);
            show_toast({ type: "error", icon: "close", text: "Erreur lors de la sélection de la couverture." });
        }
    }

    function insertPhotoInText(photo: ArticleMediaItem) {
        if (!editorComponent) return;
        editorComponent.insertImage(photo.url, photo.caption || photo.sourceTrailName, photo.caption || photo.stageLabel);
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

    function removeHeroImage(index: number) {
        heroFiles = heroFiles.filter((_, i) => i !== index);
        heroPreviews = heroPreviews.filter((_, i) => i !== index);
    }

    // Tags management
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

    async function handleSubmit() {
        if (!title.trim()) {
            show_toast({ type: "error", icon: "close", text: "Veuillez donner un titre à votre article." });
            return;
        }

        submitting = true;
        try {
            const created = await articles_create(
                {
                    title,
                    intro,
                    body,
                    total_distance: totalDistance,
                    total_elevation_gain: totalElevationGain,
                    total_days: totalDays,
                    date,
                    relation: selectedTrailIds,
                    tags: selectedTags,
                    technical_difficulty: technicalDifficulty,
                },
                heroFiles
            );

            show_toast({ type: "success", icon: "check", text: "Récit publié avec succès !" });
            goto(`/articles/${created.id}`);
        } catch (e: any) {
            console.error(e);
            show_toast({ type: "error", icon: "close", text: e.message || "Erreur lors de la publication." });
        } finally {
            submitting = false;
        }
    }
</script>

<svelte:head>
    <title>Rédiger un article | Magazine Wanderer</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-8 space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between pb-6 border-b">
        <div class="flex items-center gap-4">
            <a href="/articles" class="btn-icon text-muted-foreground hover:text-foreground" title="Retour aux articles">
                <i class="fa-solid fa-arrow-left"></i>
            </a>
            <div>
                <span class="text-xs uppercase font-bold tracking-widest text-primary">Studio Magazine</span>
                <h1 class="text-3xl font-serif font-bold text-foreground">Rédiger un nouveau récit</h1>
            </div>
        </div>
        <div class="flex items-center gap-3">
            <a href="/articles" class="btn-secondary">Annuler</a>
            <button
                type="button"
                onclick={handleSubmit}
                disabled={submitting}
                class="btn-primary flex items-center gap-2"
            >
                {#if submitting}
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    Publication...
                {:else}
                    <i class="fa-solid fa-paper-plane"></i>
                    Publier le récit
                {/if}
            </button>
        </div>
    </div>

    <!-- Two-column layout -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Writing Column (2 cols) -->
        <div class="lg:col-span-2 space-y-6">
            <!-- Title -->
            <div>
                <label for="article-title" class="block text-xs uppercase font-bold tracking-wider text-muted-foreground mb-2">
                    Titre du récit *
                </label>
                <input
                    id="article-title"
                    type="text"
                    bind:value={title}
                    placeholder="Ex: 4 jours en autonomie dans les massifs sauvages..."
                    class="w-full text-2xl font-serif font-semibold px-4 py-3 rounded-xl border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden transition-all"
                />
            </div>

            <!-- Chapô / Intro -->
            <div>
                <label for="article-intro" class="block text-xs uppercase font-bold tracking-wider text-muted-foreground mb-2">
                    Chapô d'introduction (résumé d'accroche)
                </label>
                <textarea
                    id="article-intro"
                    bind:value={intro}
                    rows="3"
                    placeholder="Une courte introduction évocatrice pour plonger le lecteur dans l'ambiance du périple..."
                    class="w-full text-base px-4 py-3 rounded-xl border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden transition-all italic"
                ></textarea>
            </div>

            <!-- Activity Media Tray (Aggregated Photos from linked trails) -->
            {#if activityPhotos.length > 0}
                <div class="bg-card border rounded-2xl p-5 shadow-xs space-y-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-images text-primary"></i>
                            <h3 class="text-sm font-bold text-foreground">
                                Photos de vos activités ({activityPhotos.length})
                            </h3>
                        </div>
                        <span class="text-xs text-muted-foreground">
                            Glissez-déposez pour réorganiser l'ordre narratif
                        </span>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {#each activityPhotos as photo, idx (photo.id)}
                            <div
                                draggable="true"
                                ondragstart={() => handleDragStart(idx)}
                                ondragover={(e) => handleDragOver(e, idx)}
                                ondragend={handleDragEnd}
                                class="relative aspect-video rounded-xl overflow-hidden border bg-neutral-900 group shadow-xs cursor-move hover:border-primary transition-all"
                            >
                                <img src={photo.url} alt={photo.caption} class="w-full h-full object-cover" />
                                
                                <span class="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    {photo.stageLabel}
                                </span>

                                <!-- Action buttons overlay -->
                                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                    <div class="flex justify-end gap-1">
                                        <button
                                            type="button"
                                            onclick={() => removeActivityPhoto(idx)}
                                            class="w-7 h-7 rounded-lg bg-card/80 hover:bg-red-600 text-foreground hover:text-white flex items-center justify-center text-xs transition-colors"
                                            title="Retirer de la médiathèque"
                                        >
                                            <i class="fa-solid fa-xmark"></i>
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() => setAsCover(photo)}
                                            class="w-7 h-7 rounded-lg bg-card/80 hover:bg-primary text-foreground hover:text-white flex items-center justify-center text-xs transition-colors"
                                            title="Définir en couverture"
                                        >
                                            <i class="fa-solid fa-star"></i>
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() => insertPhotoInText(photo)}
                                            class="w-7 h-7 rounded-lg bg-card/80 hover:bg-primary text-foreground hover:text-white flex items-center justify-center text-xs transition-colors"
                                            title="Insérer dans le texte au curseur"
                                        >
                                            <i class="fa-solid fa-arrow-down"></i>
                                        </button>
                                    </div>
                                    <p class="text-[10px] text-white truncate font-medium">
                                        {photo.caption}
                                    </p>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Hero Cover Upload (Fallback / Custom Cover) -->
            <div>
                <label class="block text-xs uppercase font-bold tracking-wider text-muted-foreground mb-2">
                    Image de couverture grand format
                </label>
                <div class="border-2 border-dashed border-border/80 rounded-2xl p-5 text-center hover:border-primary/60 transition-colors bg-card/30">
                    {#if heroPreviews.length > 0}
                        <div class="flex flex-wrap gap-3 mb-4 justify-center">
                            {#each heroPreviews as preview, idx}
                                <div class="relative w-40 aspect-video rounded-xl overflow-hidden border shadow-xs group">
                                    <img src={preview} alt="Aperçu hero" class="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onclick={() => removeHeroImage(idx)}
                                        class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                        aria-label="Supprimer photo"
                                    >
                                        <i class="fa-solid fa-xmark text-xs"></i>
                                    </button>
                                    {#if idx === 0}
                                        <span class="absolute bottom-1 left-1 text-[9px] uppercase font-bold bg-primary text-white px-1.5 py-0.5 rounded">
                                            Couverture
                                        </span>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}

                    <label class="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/40 text-primary font-medium hover:bg-primary/10 transition-colors text-xs">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        <span>{heroPreviews.length > 0 ? "Ajouter une autre image" : "Téléverser une couverture personnalisée"}</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onchange={handleFileSelect}
                            class="hidden"
                        />
                    </label>
                </div>
            </div>

            <!-- Body / Rich Text Editor -->
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <label class="block text-xs uppercase font-bold tracking-wider text-muted-foreground">
                        Corps du récit
                    </label>
                </div>

                <div class="border rounded-2xl bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary">
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
        </div>

        <!-- Sidebar Column (1 col) -->
        <div class="space-y-6">
            <!-- Trail Association Widget -->
            <div class="bg-card border rounded-2xl p-5 shadow-xs">
                <TrailPicker
                    bind:selectedIds={selectedTrailIds}
                    onchange={handleTrailsChange}
                />
            </div>

            <!-- Technical Difficulty Level ("Offroad Index") -->
            <div class="bg-card border rounded-2xl p-5 shadow-xs space-y-3">
                <div class="flex items-center justify-between">
                    <h3 class="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                        Difficulté technique
                    </h3>
                    <span class="text-xs font-bold {technicalDifficulty > 0 ? TECHNICAL_DIFFICULTY_LEVELS[technicalDifficulty]?.color : 'text-muted-foreground'}">
                        {technicalDifficulty > 0 ? `Niveau ${technicalDifficulty}/5` : 'Non défini'}
                    </span>
                </div>

                <div class="grid grid-cols-5 gap-1.5">
                    {#each [1, 2, 3, 4, 5] as lvl}
                        {@const cfg = TECHNICAL_DIFFICULTY_LEVELS[lvl]}
                        <button
                            type="button"
                            onclick={() => { technicalDifficulty = technicalDifficulty === lvl ? 0 : lvl; }}
                            class="py-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center {technicalDifficulty >= lvl ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color} shadow-2xs font-extrabold` : 'bg-background border-border text-muted-foreground hover:border-primary/50'}"
                        >
                            <span>{lvl}</span>
                        </button>
                    {/each}
                </div>

                {#if technicalDifficulty > 0}
                    {@const cur = TECHNICAL_DIFFICULTY_LEVELS[technicalDifficulty]}
                    <div class="p-3 rounded-xl {cur.bgColor} border {cur.borderColor} space-y-1">
                        <p class="text-xs font-bold {cur.color}">{cur.title}</p>
                        <p class="text-[11px] text-muted-foreground leading-relaxed">{cur.subtitle}</p>
                    </div>
                {/if}
            </div>

            <!-- Editorial Tags Selector -->
            <div class="bg-card border rounded-2xl p-5 shadow-xs space-y-4">
                <h3 class="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                    Tags éditoriaux
                </h3>

                <!-- Selected tags active display -->
                {#if selectedTags.length > 0}
                    <div class="flex flex-wrap gap-1.5 pb-2 border-b border-border/50">
                        {#each selectedTags as tag}
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary text-white shadow-2xs">
                                <span>{tag}</span>
                                <button
                                    type="button"
                                    onclick={() => removeTag(tag)}
                                    class="hover:opacity-75"
                                    aria-label="Retirer {tag}"
                                >
                                    <i class="fa-solid fa-xmark text-[10px]"></i>
                                </button>
                            </span>
                        {/each}
                    </div>
                {/if}

                <!-- Official categories -->
                <div class="space-y-3">
                    {#each EDITORIAL_TAG_CATEGORIES as category}
                        <div class="space-y-1.5">
                            <span class="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                                <i class="fa-solid fa-{category.icon} text-primary"></i>
                                {category.label}
                            </span>
                            <div class="flex flex-wrap gap-1.5">
                                {#each category.tags as tag}
                                    {@const isSelected = selectedTags.includes(tag)}
                                    <button
                                        type="button"
                                        onclick={() => toggleTag(tag)}
                                        class="px-2 py-1 rounded-lg text-xs font-medium border transition-colors {isSelected ? 'bg-primary/20 border-primary text-primary font-bold' : 'bg-background border-border text-foreground/80 hover:border-primary/50'}"
                                    >
                                        {tag}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Custom Tag Input -->
                <div class="pt-2">
                    <label for="custom-tag-input" class="block text-[11px] font-bold text-muted-foreground mb-1.5">
                        Tags libres (optionnel)
                    </label>
                    <div class="flex gap-2">
                        <input
                            id="custom-tag-input"
                            type="text"
                            bind:value={customTagInput}
                            onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                            placeholder="Ex: Tour du Mont-Blanc, bivouac..."
                            class="w-full px-3 py-1.5 rounded-xl border bg-background text-xs"
                        />
                        <button
                            type="button"
                            onclick={addCustomTag}
                            class="btn-secondary py-1.5 px-3 text-xs"
                        >
                            Ajouter
                        </button>
                    </div>
                </div>
            </div>

            <!-- Global Journey Metrics -->
            <div class="bg-card border rounded-2xl p-5 shadow-xs space-y-4">
                <h3 class="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                    Données globales du voyage
                </h3>

                <div>
                    <label for="metric-distance" class="block text-xs text-muted-foreground mb-1">Distance totale (km)</label>
                    <div class="relative">
                        <input
                            id="metric-distance"
                            type="number"
                            step="1"
                            bind:value={totalDistance}
                            class="w-full px-3 py-2 rounded-xl border bg-background text-sm font-semibold"
                        />
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
                    </div>
                </div>

                <div>
                    <label for="metric-elevation" class="block text-xs text-muted-foreground mb-1">Dénivelé positif (m D+)</label>
                    <div class="relative">
                        <input
                            id="metric-elevation"
                            type="number"
                            step="10"
                            bind:value={totalElevationGain}
                            class="w-full px-3 py-2 rounded-xl border bg-background text-sm font-semibold"
                        />
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">m</span>
                    </div>
                </div>

                <div>
                    <label for="metric-days" class="block text-xs text-muted-foreground mb-1">Durée (nombre de jours)</label>
                    <div class="relative">
                        <input
                            id="metric-days"
                            type="number"
                            min="1"
                            bind:value={totalDays}
                            class="w-full px-3 py-2 rounded-xl border bg-background text-sm font-semibold"
                        />
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">jours</span>
                    </div>
                </div>

                <div>
                    <label for="metric-date" class="block text-xs text-muted-foreground mb-1">Date de l'expédition</label>
                    <input
                        id="metric-date"
                        type="date"
                        bind:value={date}
                        class="w-full px-3 py-2 rounded-xl border bg-background text-sm"
                    />
                </div>
            </div>

            <!-- Publishing Action -->
            <div class="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-3">
                <button
                    type="button"
                    onclick={handleSubmit}
                    disabled={submitting}
                    class="w-full btn-primary py-3 flex items-center justify-center gap-2"
                >
                    {#if submitting}
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        Publication...
                    {:else}
                        <i class="fa-solid fa-check"></i>
                        Enregistrer et publier
                    {/if}
                </button>
            </div>
        </div>
    </div>
</div>
