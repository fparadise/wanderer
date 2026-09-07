<script lang="ts">
    import { goto } from "$app/navigation";
    import Editor from "$lib/components/base/editor.svelte";
    import TrailPicker from "$lib/components/article/trail_picker.svelte";
    import type { Trail } from "$lib/models/trail";
    import { articles_create } from "$lib/stores/article_store";
    import { show_toast } from "$lib/stores/toast_store.svelte";
    import { currentUser } from "$lib/stores/user_store";
    import { _ } from "svelte-i18n";

    let title: string = $state("");
    let intro: string = $state("");
    let body: string = $state("");
    let totalDistance: number = $state(0);
    let totalElevationGain: number = $state(0);
    let totalDays: number = $state(1);
    let date: string = $state(new Date().toISOString().substring(0, 10));
    let selectedTrailIds: string[] = $state([]);
    let heroFiles: File[] = $state([]);
    let heroPreviews: string[] = $state([]);
    let submitting: boolean = $state(false);

    function handleTrailsChange(selectedTrails: Trail[]) {
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
        }
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
                },
                heroFiles
            );

            show_toast({ type: "success", icon: "check", text: "Article publié avec succès !" });
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

<div class="max-w-6xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between pb-6 mb-8 border-b">
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

    <!-- Two-column grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Form Column (2 cols) -->
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
                    placeholder="Ex: 4 jours en autonomie dans les grands espaces..."
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
                    placeholder="Une courte introduction évocatrice pour plonger le lecteur dans l'ambiance de l'aventure..."
                    class="w-full text-base px-4 py-3 rounded-xl border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden transition-all italic"
                ></textarea>
            </div>

            <!-- Hero Images Upload -->
            <div>
                <label class="block text-xs uppercase font-bold tracking-wider text-muted-foreground mb-2">
                    Photos de couverture & galerie hero
                </label>
                <div class="border-2 border-dashed border-border/80 rounded-2xl p-6 text-center hover:border-primary/60 transition-colors bg-card/30">
                    {#if heroPreviews.length > 0}
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                            {#each heroPreviews as preview, idx}
                                <div class="relative aspect-video rounded-xl overflow-hidden border shadow-xs group">
                                    <img src={preview} alt="Aperçu hero" class="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onclick={() => removeHeroImage(idx)}
                                        class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                        aria-label="Supprimer photo"
                                    >
                                        <i class="fa-solid fa-xmark text-xs"></i>
                                    </button>
                                    {#if idx === 0}
                                        <span class="absolute bottom-2 left-2 text-[10px] uppercase font-bold bg-primary text-white px-2 py-0.5 rounded-sm">
                                            Couverture principale
                                        </span>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}

                    <label class="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/40 text-primary font-medium hover:bg-primary/10 transition-colors">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        <span>{heroPreviews.length > 0 ? "Ajouter d'autres photos" : "Téléverser des photos (JPG, PNG, WebP)"}</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onchange={handleFileSelect}
                            class="hidden"
                        />
                    </label>
                    <p class="text-xs text-muted-foreground mt-2">La première photo servira d'image de couverture grand format.</p>
                </div>
            </div>

            <!-- Body / Rich Text Editor -->
            <div>
                <label class="block text-xs uppercase font-bold tracking-wider text-muted-foreground mb-2">
                    Corps du récit
                </label>
                <div class="border rounded-2xl bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary">
                    <Editor
                        bind:value={body}
                        placeholder="Racontez votre expérience, partagez vos impressions, les conditions de sentier, les moments forts..."
                        extraClasses="min-h-[350px] p-4 prose dark:prose-invert max-w-none focus:outline-hidden"
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

            <!-- Voyage Metrics -->
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

            <!-- Publishing card -->
            <div class="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-3">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-feather"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-foreground">Publication ouverte</p>
                        <p class="text-[11px] text-muted-foreground">Votre récit sera visible dans la galerie Magazine.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onclick={handleSubmit}
                    disabled={submitting}
                    class="w-full btn-primary py-3 flex items-center justify-center gap-2"
                >
                    {#if submitting}
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        Enregistrement...
                    {:else}
                        <i class="fa-solid fa-check"></i>
                        Enregistrer et publier
                    {/if}
                </button>
            </div>
        </div>
    </div>
</div>
