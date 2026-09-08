<script lang="ts">
    import { goto } from "$app/navigation";
    import Editor from "$lib/components/base/editor.svelte";
    import TrailPicker from "$lib/components/article/trail_picker.svelte";
    import type { Trail } from "$lib/models/trail";
    import { articles_update, articles_delete } from "$lib/stores/article_store";
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
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    let article = $derived(data.article);

    let title: string = $state(data.article.title || "");
    let intro: string = $state(data.article.intro || "");
    let body: string = $state(data.article.body || "");
    let totalDistance: number = $state(data.article.total_distance ?? 0);
    let totalElevationGain: number = $state(data.article.total_elevation_gain ?? 0);
    let totalDays: number = $state(data.article.total_days ?? 1);
    let date: string = $state(data.article.date || new Date().toISOString().substring(0, 10));
    let technicalDifficulty: number = $state(data.article.technical_difficulty ?? 0);
    let selectedTags: string[] = $state(data.article.tags ? [...data.article.tags] : []);
    let customTagInput: string = $state("");

    let selectedTrailIds: string[] = $state(data.article.relation ? [...data.article.relation] : []);
    let loadedTrails: Trail[] = $state(data.article.expand?.relation || []);
    let activityPhotos: ArticleMediaItem[] = $state([]);
    let rawHeroImages: string[] = $state(data.article.hero_images ? [...data.article.hero_images] : []);
    let deletedHeroImages: string[] = $state([]);
    let existingHeroImages: string[] = $state(
        data.article.hero_images ? data.article.hero_images.map((img) => getFileURL(data.article, img)) : []
    );
    let heroFiles: File[] = $state([]);
    let heroPreviews: string[] = $state([]);
    let submitting: boolean = $state(false);
    let deleting: boolean = $state(false);
    let showDeleteConfirm: boolean = $state(false);

    let editorComponent: any = $state();

    // Drag and drop state for photos
    let draggedPhotoIdx: number | null = $state(null);

    let canEdit = $derived(
        $currentUser &&
        (article.author === $currentUser.actor ||
         article.expand?.author?.user === $currentUser.id ||
         $currentUser.is_admin === true)
    );

    onMount(() => {
        if (!canEdit) {
            show_toast({ type: "error", icon: "close", text: "Vous n'avez pas l'autorisation de modifier ce récit." });
            goto(`/articles/${article.id}`);
            return;
        }
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
            selectedTrailIds = fullTrails.map((t) => t.id!);
            extractActivityPhotos(fullTrails);
        } else {
            loadedTrails = [];
            selectedTrailIds = [];
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

    function removeExistingHeroImage(index: number) {
        const removed = rawHeroImages[index];
        if (removed) {
            deletedHeroImages = [...deletedHeroImages, removed];
        }
        rawHeroImages = rawHeroImages.filter((_, i) => i !== index);
        existingHeroImages = existingHeroImages.filter((_, i) => i !== index);
        show_toast({ type: "info", icon: "check", text: "Photo retirée (sera supprimée à l'enregistrement)." });
    }

    function removeActivityPhoto(index: number) {
        activityPhotos = activityPhotos.filter((_, i) => i !== index);
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
            const updated = await articles_update(
                article.id!,
                {
                    title,
                    intro,
                    body,
                    total_distance: totalDistance,
                    total_elevation_gain: totalElevationGain,
                    total_days: totalDays,
                    date,
                    technical_difficulty: technicalDifficulty,
                    tags: selectedTags,
                    relation: selectedTrailIds,
                },
                heroFiles,
                deletedHeroImages
            );

            show_toast({ type: "success", icon: "check", text: "Récit mis à jour avec succès !" });
            goto(`/articles/${updated.id}`);
        } catch (e: any) {
            show_toast({ type: "error", icon: "close", text: e.message || "Erreur lors de la mise à jour." });
        } finally {
            submitting = false;
        }
    }

    async function handleDeleteArticle() {
        deleting = true;
        try {
            await articles_delete(article.id!);
            show_toast({ type: "success", icon: "check", text: "Récit supprimé définitivement." });
            goto("/articles");
        } catch (e: any) {
            show_toast({ type: "error", icon: "close", text: e.message || "Erreur lors de la suppression." });
        } finally {
            deleting = false;
            showDeleteConfirm = false;
        }
    }
</script>

<svelte:head>
    <title>Modifier : {title || article.title} | Magazine Wanderer</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b">
        <div class="space-y-1">
            <div class="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                <a href="/articles/{article.id}" class="hover:text-primary transition-colors flex items-center gap-1">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span>Retour au récit</span>
                </a>
                <span>/</span>
                <span class="text-primary">Édition</span>
            </div>
            <h1 class="text-3xl font-serif font-bold text-foreground">
                Modifier le carnet de voyage
            </h1>
        </div>

        <div class="flex items-center gap-3">
            <a href="/articles/{article.id}" class="btn-secondary text-xs py-2 px-4 rounded-xl">
                Annuler
            </a>
            <button
                type="button"
                onclick={handleSubmit}
                disabled={submitting}
                class="btn-primary text-xs py-2 px-5 flex items-center gap-2 rounded-xl shadow-xs"
            >
                {#if submitting}
                    <i class="fa-solid fa-spinner animate-spin"></i>
                    <span>Enregistrement...</span>
                {:else}
                    <i class="fa-solid fa-floppy-disk"></i>
                    <span>Enregistrer les modifications</span>
                {/if}
            </button>
        </div>
    </div>

    <!-- Step 1: Linked Trails & Activities -->
    <div class="p-6 rounded-2xl border bg-card space-y-4 shadow-xs">
        <div class="flex items-center justify-between">
            <div>
                <h3 class="font-serif font-bold text-lg text-foreground flex items-center gap-2">
                    <i class="fa-solid fa-route text-primary"></i>
                    1. Traces et étapes associées
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                    Sélectionnez vos activités pour importer le tracé global, les statistiques et les photos.
                </p>
            </div>
        </div>

        <TrailPicker
            bind:selectedIds={selectedTrailIds}
            onchange={handleTrailsChange}
        />
    </div>

    <!-- Step 2: Drag-and-Drop Photos Tray -->
    {#if activityPhotos.length > 0}
        <div class="p-6 rounded-2xl border bg-card space-y-4 shadow-xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h3 class="font-serif font-bold text-lg text-foreground flex items-center gap-2">
                        <i class="fa-solid fa-images text-primary"></i>
                        2. Médiathèque des activités ({activityPhotos.length})
                    </h3>
                    <p class="text-xs text-muted-foreground mt-0.5">
                        Glissez-déposez pour réorganiser l'ordre éditorial des photos, définissez la couverture ou insérez-les dans le texte.
                    </p>
                </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {#each activityPhotos as photo, idx}
                    <div
                        draggable="true"
                        role="listitem"
                        ondragstart={() => handleDragStart(idx)}
                        ondragover={(e) => handleDragOver(e, idx)}
                        ondragend={handleDragEnd}
                        class="group relative aspect-square rounded-xl overflow-hidden border bg-neutral-900 shadow-2xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all select-none {draggedPhotoIdx === idx ? 'opacity-40 ring-2 ring-primary scale-95' : ''}"
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
                            title="Retirer de la médiathèque"
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

    <!-- Step 3: Main Editorial Metadata -->
    <div class="p-6 rounded-2xl border bg-card space-y-6 shadow-xs">
        <h3 class="font-serif font-bold text-lg text-foreground flex items-center gap-2">
            <i class="fa-solid fa-pen-nib text-primary"></i>
            3. Présentation & Récit
        </h3>

        <div class="space-y-4">
            <div>
                <label for="article-title" class="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                    Titre du récit *
                </label>
                <input
                    id="article-title"
                    type="text"
                    bind:value={title}
                    placeholder="Ex: Traversée du Mercantour en autonomie"
                    class="input w-full text-lg font-serif font-bold"
                />
            </div>

            <div>
                <label for="article-intro" class="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                    Introduction / Chapeau
                </label>
                <textarea
                    id="article-intro"
                    bind:value={intro}
                    rows="3"
                    placeholder="Une courte introduction pour captiver le lecteur..."
                    class="input w-full font-serif text-sm leading-relaxed"
                ></textarea>
            </div>

            <!-- Key metrics -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div>
                    <label for="metric-dist" class="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Distance (km)
                    </label>
                    <input
                        id="metric-dist"
                        type="number"
                        bind:value={totalDistance}
                        class="input w-full font-semibold"
                    />
                </div>
                <div>
                    <label for="metric-ele" class="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Dénivelé D+ (m)
                    </label>
                    <input
                        id="metric-ele"
                        type="number"
                        bind:value={totalElevationGain}
                        class="input w-full font-semibold"
                    />
                </div>
                <div>
                    <label for="metric-days" class="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Nombre de jours
                    </label>
                    <input
                        id="metric-days"
                        type="number"
                        min="1"
                        bind:value={totalDays}
                        class="input w-full font-semibold"
                    />
                </div>
                <div>
                    <label for="metric-date" class="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Date de départ
                    </label>
                    <input
                        id="metric-date"
                        type="date"
                        bind:value={date}
                        class="input w-full font-semibold"
                    />
                </div>
            </div>

            <!-- Technical Difficulty (1-5) -->
            <div class="pt-4 border-t space-y-2">
                <label class="block text-xs font-bold uppercase tracking-wider text-foreground">
                    Difficulté technique / Offroad index
                </label>
                <p class="text-xs text-muted-foreground">
                    Indiquez le niveau d'engagement technique et de pilotage du terrain :
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
                    {#each Object.entries(TECHNICAL_DIFFICULTY_LEVELS) as [lvlStr, level]}
                        {@const lvl = parseInt(lvlStr, 10)}
                        <button
                            type="button"
                            onclick={() => technicalDifficulty = technicalDifficulty === lvl ? 0 : lvl}
                            class="p-3 rounded-xl border text-left transition-all {technicalDifficulty === lvl ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary' : 'bg-card hover:border-border text-muted-foreground'}"
                        >
                            <div class="flex items-center justify-between mb-1">
                                <span class="font-bold text-xs" style="color: {level.color}">Niv. {level.level}</span>
                                {#if technicalDifficulty === lvl}
                                    <i class="fa-solid fa-circle-check text-primary text-xs"></i>
                                {/if}
                            </div>
                            <div class="font-semibold text-xs text-foreground truncate">{level.title}</div>
                            <div class="text-[10px] text-muted-foreground line-clamp-2 mt-1 leading-tight">{level.subtitle}</div>
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Editorial Tags -->
            <div class="pt-4 border-t space-y-3">
                <label class="block text-xs font-bold uppercase tracking-wider text-foreground">
                    Tags éditoriaux
                </label>
                <div class="space-y-3">
                    {#each EDITORIAL_TAG_CATEGORIES as cat}
                        <div>
                            <span class="text-[11px] font-semibold text-muted-foreground uppercase">{cat.label}</span>
                            <div class="flex flex-wrap gap-1.5 mt-1.5">
                                {#each cat.tags as tag}
                                    <button
                                        type="button"
                                        onclick={() => toggleTag(tag)}
                                        class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors {selectedTags.includes(tag) ? 'bg-primary text-white border-primary shadow-xs' : 'bg-card text-muted-foreground hover:text-foreground'}"
                                    >
                                        #{tag}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/each}

                    <!-- Custom Tag -->
                    <div class="flex items-center gap-2 pt-2 max-w-sm">
                        <input
                            type="text"
                            bind:value={customTagInput}
                            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
                            placeholder="Ajouter un tag personnalisé..."
                            class="input flex-1 text-xs"
                        />
                        <button
                            type="button"
                            onclick={addCustomTag}
                            class="btn-secondary text-xs py-2 px-3 rounded-xl"
                        >
                            Ajouter
                        </button>
                    </div>

                    {#if selectedTags.length > 0}
                        <div class="flex flex-wrap items-center gap-1.5 pt-2">
                            <span class="text-xs text-muted-foreground font-semibold mr-1">Tags sélectionnés :</span>
                            {#each selectedTags as tag}
                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary">
                                    #{tag}
                                    <button
                                        type="button"
                                        onclick={() => removeTag(tag)}
                                        class="hover:text-red-500 ml-0.5 text-[10px]"
                                    >
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </span>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Hero Cover Upload (Extra / Override) -->
            <div class="pt-4 border-t space-y-3">
                <label class="block text-xs font-bold uppercase tracking-wider text-foreground">
                    Nouvelle image de couverture ou photos additionnelles
                </label>
                <div class="flex items-center gap-4">
                    <label class="btn-secondary text-xs py-2 px-4 rounded-xl cursor-pointer flex items-center gap-2">
                        <i class="fa-solid fa-upload"></i>
                        <span>Téléverser des fichiers</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onchange={handleFileSelect}
                            class="hidden"
                        />
                    </label>
                    <span class="text-xs text-muted-foreground">JPG, PNG ou WebP</span>
                </div>

                <!-- Existing & New Previews -->
                <div class="flex flex-wrap gap-3 pt-2">
                    {#each existingHeroImages as imgUrl, idx}
                        <div class="relative w-24 h-24 rounded-xl overflow-hidden border bg-neutral-900 shadow-2xs group">
                            <img src={imgUrl} alt="Hero existant" class="w-full h-full object-cover" />
                            <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white">Actuel</span>
                            <button
                                type="button"
                                onclick={() => removeExistingHeroImage(idx)}
                                title="Supprimer cette photo de couverture"
                                class="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-xs"
                            >
                                <i class="fa-solid fa-trash-can text-[10px]"></i>
                            </button>
                        </div>
                    {/each}
                    {#each heroPreviews as preview, idx}
                        <div class="relative w-24 h-24 rounded-xl overflow-hidden border bg-neutral-900 shadow-2xs group">
                            <img src={preview} alt="Aperçu nouveau" class="w-full h-full object-cover" />
                            <button
                                type="button"
                                onclick={() => removeHeroImage(idx)}
                                class="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    </div>

    <!-- Step 4: Article Text Body with Rich Editor -->
    <div class="p-6 rounded-2xl border bg-card space-y-4 shadow-xs">
        <div>
            <h3 class="font-serif font-bold text-lg text-foreground flex items-center gap-2">
                <i class="fa-solid fa-book text-primary"></i>
                4. Corps du récit
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5">
                Rédigez votre histoire, insérez des citations, des photos avec mise en page et marquez des points kilométriques directement depuis la barre d'outils.
            </p>
        </div>

        <Editor
            bind:this={editorComponent}
            bind:value={body}
            mediaItems={activityPhotos}
            trails={loadedTrails}
        />
    </div>

    <!-- Actions & Danger Zone -->
    <div class="space-y-6 pt-4">
        <div class="flex items-center justify-end gap-3">
            <a href="/articles/{article.id}" class="btn-secondary text-sm py-2.5 px-6 rounded-xl">
                Annuler
            </a>
            <button
                type="button"
                onclick={handleSubmit}
                disabled={submitting}
                class="btn-primary text-sm py-2.5 px-7 flex items-center gap-2 rounded-xl shadow-md"
            >
                {#if submitting}
                    <i class="fa-solid fa-spinner animate-spin"></i>
                    <span>Enregistrement...</span>
                {:else}
                    <i class="fa-solid fa-floppy-disk"></i>
                    <span>Mettre à jour le récit</span>
                {/if}
            </button>
        </div>

        <!-- Danger Zone: Delete Article -->
        <div class="p-6 rounded-2xl border border-red-500/30 bg-red-500/5 space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="space-y-1">
                    <h4 class="font-bold text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        Zone de danger
                    </h4>
                    <p class="text-xs text-muted-foreground">
                        La suppression de ce récit de voyage est définitive. Les traces GPS associées ne seront pas supprimées.
                    </p>
                </div>

                <button
                    type="button"
                    onclick={() => showDeleteConfirm = true}
                    class="btn-destructive text-xs py-2 px-4 rounded-xl flex items-center gap-2 shrink-0 self-start sm:self-auto"
                >
                    <i class="fa-solid fa-trash-can"></i>
                    <span>Supprimer ce récit</span>
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Modal: Confirm Delete Article -->
{#if showDeleteConfirm}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div class="bg-card border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center gap-3 text-red-600">
                <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-xl shrink-0">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div>
                    <h3 class="font-serif font-bold text-lg text-foreground">
                        Supprimer cet article ?
                    </h3>
                    <p class="text-xs text-muted-foreground">Cette action est irréversible.</p>
                </div>
            </div>

            <p class="text-xs text-muted-foreground leading-relaxed">
                Êtes-vous certain de vouloir supprimer le carnet de voyage <strong>«&nbsp;{article.title}&nbsp;»</strong> ? Toutes les métadonnées et le contenu seront effacés.
            </p>

            <div class="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                    type="button"
                    onclick={() => showDeleteConfirm = false}
                    disabled={deleting}
                    class="btn-secondary text-xs py-2 px-4 rounded-xl"
                >
                    Annuler
                </button>
                <button
                    type="button"
                    onclick={handleDeleteArticle}
                    disabled={deleting}
                    class="btn-destructive text-xs py-2 px-5 rounded-xl font-semibold flex items-center gap-2"
                >
                    {#if deleting}
                        <i class="fa-solid fa-spinner animate-spin"></i>
                        <span>Suppression...</span>
                    {:else}
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Supprimer définitivement</span>
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}
