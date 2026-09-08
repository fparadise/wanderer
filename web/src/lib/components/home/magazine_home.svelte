<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { getFileURL } from "$lib/util/file_util";
    import { TECHNICAL_DIFFICULTY_LEVELS } from "$lib/models/editorial_tags";
    import { currentUser } from "$lib/stores/user_store";
    import { _ } from "svelte-i18n";
    import type { Article } from "$lib/models/article";
    import type { Trail } from "$lib/models/trail";

    interface Props {
        data: {
            articles?: Article[];
            recentTrails?: Trail[];
        };
    }

    let { data }: Props = $props();

    let articles = $derived(data.articles || []);
    let featuredArticle = $derived(articles.length > 0 ? articles[0] : null);
    let restArticles = $derived(articles.length > 1 ? articles.slice(1) : []);
    let recentTrails = $derived(data.recentTrails || []);

    let selectedTagFilter: string | null = $state(null);

    let filteredArticles = $derived(
        selectedTagFilter
            ? restArticles.filter((a) => (a.tags || []).includes(selectedTagFilter!))
            : restArticles
    );

    // Collect all available tags across articles for quick filtering
    let allArticleTags = $derived.by(() => {
        const set = new Set<string>();
        articles.forEach((a) => (a.tags || []).forEach((t) => set.add(t)));
        return Array.from(set);
    });
</script>

<svelte:head>
    <title>Wanderer | Le Magazine & Carnets d'Itinéraires</title>
</svelte:head>

<div class="min-h-screen pt-4 sm:pt-6 pb-24 space-y-16">
    <!-- Magazine Featured Hero Story -->
    {#if featuredArticle}
        {@const coverUrl = featuredArticle.hero_images && featuredArticle.hero_images.length > 0 ? getFileURL(featuredArticle, featuredArticle.hero_images[0]) : null}
        {@const author = featuredArticle.expand?.author}
        {@const techDiff = featuredArticle.technical_difficulty ? TECHNICAL_DIFFICULTY_LEVELS[featuredArticle.technical_difficulty] : null}

        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <a
                href="/articles/{featuredArticle.id}"
                class="group block relative rounded-3xl overflow-hidden border shadow-md hover:shadow-xl transition-all duration-500 bg-neutral-950 text-white min-h-[500px] lg:min-h-[580px]"
            >
                <!-- Background Image & Atmospheric Gradients -->
                {#if coverUrl}
                    <img
                        src={coverUrl}
                        alt={featuredArticle.title}
                        class="absolute inset-0 w-full h-full object-cover object-center opacity-75 group-hover:scale-105 transition-transform duration-1000"
                    />
                {:else}
                    <div class="absolute inset-0 bg-gradient-to-br from-primary/40 via-neutral-900 to-black"></div>
                {/if}
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent"></div>

                <!-- Featured Story Content -->
                <div class="relative h-full flex flex-col justify-end p-6 sm:p-10 lg:p-14 max-w-3xl space-y-6">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-primary text-white shadow-lg">
                            <i class="fa-solid fa-compass"></i> À la une
                        </span>
                        {#if techDiff}
                            <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/20 backdrop-blur-md text-white border border-white/30">
                                {techDiff.title}
                            </span>
                        {/if}
                        {#if featuredArticle.total_distance > 0}
                            <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/60 backdrop-blur-md text-white/90">
                                {featuredArticle.total_distance} km · +{featuredArticle.total_elevation_gain} m
                            </span>
                        {/if}
                        {#if featuredArticle.total_days > 0}
                            <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/60 backdrop-blur-md text-white/90">
                                {featuredArticle.total_days} {featuredArticle.total_days > 1 ? 'jours' : 'jour'}
                            </span>
                        {/if}
                    </div>

                    <h2 class="text-3xl sm:text-5xl lg:text-6xl font-serif font-extrabold leading-tight tracking-tight group-hover:text-primary-light transition-colors drop-shadow-md">
                        {featuredArticle.title}
                    </h2>

                    {#if featuredArticle.intro}
                        <p class="text-base sm:text-lg text-white/80 font-serif italic line-clamp-3 leading-relaxed drop-shadow-xs">
                            {featuredArticle.intro}
                        </p>
                    {/if}

                    <!-- Author Bar & Read Prompt -->
                    <div class="flex items-center justify-between pt-4 border-t border-white/20">
                        <div class="flex items-center gap-3">
                            {#if author}
                                <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-primary shrink-0 shadow-md">
                                    <img
                                        src={author.icon ? getFileURL(author, author.icon) : `https://api.dicebear.com/7.x/initials/svg?seed=${author.preferred_username || 'A'}`}
                                        alt={author.preferred_username || author.username}
                                        class="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-white">
                                        {author.preferred_username || author.username}
                                    </p>
                                    <p class="text-xs text-white/60">
                                        {new Date(featuredArticle.date || featuredArticle.created || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            {/if}
                        </div>

                        <span class="btn-primary text-xs py-2.5 px-5 rounded-full inline-flex items-center gap-2 group-hover:translate-x-1 transition-transform shadow-lg">
                            <span>Lire le grand récit</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </span>
                    </div>
                </div>
            </a>
        </section>
    {:else}
        <!-- Fallback if no articles exist yet -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
            <div class="max-w-xl mx-auto p-8 rounded-3xl border bg-card shadow-xs space-y-4">
                <i class="fa-solid fa-book-open text-4xl text-primary"></i>
                <h2 class="text-2xl font-serif font-bold text-foreground">Bienvenue dans le Magazine</h2>
                <p class="text-sm text-muted-foreground">
                    Partagez vos voyages et expéditions en reliant vos traces GPS à des récits immersifs.
                </p>
                {#if $currentUser}
                    <a href="/articles/new" class="btn-primary inline-flex items-center gap-2">
                        <i class="fa-solid fa-feather"></i>
                        <span>Écrire le premier récit</span>
                    </a>
                {/if}
            </div>
        </section>
    {/if}

    <!-- Main Content: Two Columns (Recent Stories 2/3 & Recent Activities 1/3) -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <!-- Left 2 Cols: Recent Magazine Stories -->
            <div class="lg:col-span-2 space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
                    <div>
                        <span class="text-xs uppercase font-bold tracking-wider text-primary">Carnets de route</span>
                        <h3 class="text-2xl font-serif font-bold text-foreground">Derniers récits d'aventures</h3>
                    </div>

                    <!-- Tag Filter Pills -->
                    {#if allArticleTags.length > 0}
                        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                            <button
                                type="button"
                                onclick={() => { selectedTagFilter = null; }}
                                class="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 {selectedTagFilter === null ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground hover:text-foreground'}"
                            >
                                Tous
                            </button>
                            {#each allArticleTags.slice(0, 6) as tag}
                                <button
                                    type="button"
                                    onclick={() => { selectedTagFilter = selectedTagFilter === tag ? null : tag; }}
                                    class="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 {selectedTagFilter === tag ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground hover:text-foreground'}"
                                >
                                    #{tag}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>

                {#if filteredArticles.length === 0}
                    <p class="text-sm text-muted-foreground italic py-8 text-center bg-card/40 rounded-2xl border border-dashed">
                        Aucun autre récit ne correspond à ce filtre.
                    </p>
                {:else}
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {#each filteredArticles as article}
                            {@const coverUrl = article.hero_images && article.hero_images.length > 0 ? getFileURL(article, article.hero_images[0]) : null}
                            {@const author = article.expand?.author}
                            {@const techDiff = article.technical_difficulty ? TECHNICAL_DIFFICULTY_LEVELS[article.technical_difficulty] : null}

                            <a
                                href="/articles/{article.id}"
                                class="group rounded-2xl overflow-hidden border bg-card hover:border-primary/50 transition-all duration-300 flex flex-col shadow-xs hover:shadow-md"
                            >
                                <div class="aspect-16/10 relative overflow-hidden bg-neutral-900">
                                    {#if coverUrl}
                                        <img
                                            src={coverUrl}
                                            alt={article.title}
                                            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    {:else}
                                        <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
                                            <i class="fa-solid fa-mountain text-4xl text-primary/30"></i>
                                        </div>
                                    {/if}

                                    <div class="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                                        {#if article.total_distance > 0}
                                            <span class="bg-black/75 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded-md">
                                                {article.total_distance} km · +{article.total_elevation_gain} m
                                            </span>
                                        {/if}
                                        {#if techDiff}
                                            <span class="bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                                Niv. {techDiff.level}
                                            </span>
                                        {/if}
                                    </div>
                                </div>

                                <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
                                    <div class="space-y-2">
                                        <!-- Tags inline -->
                                        {#if article.tags && article.tags.length > 0}
                                            <div class="flex flex-wrap gap-1">
                                                {#each article.tags.slice(0, 2) as t}
                                                    <span class="text-[10px] uppercase font-bold text-primary">#{t}</span>
                                                {/each}
                                            </div>
                                        {/if}

                                        <h4 class="text-base sm:text-lg font-serif font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                                            {article.title}
                                        </h4>
                                        {#if article.intro}
                                            <p class="text-xs text-muted-foreground line-clamp-2 italic font-serif leading-relaxed">
                                                {article.intro}
                                            </p>
                                        {/if}
                                    </div>

                                    <div class="flex items-center justify-between pt-3 border-t border-border/60 text-xs text-muted-foreground">
                                        <span class="font-medium">{author?.preferred_username || author?.username || "Auteur"}</span>
                                        <span>{new Date(article.date || article.created || Date.now()).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>
                                    </div>
                                </div>
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Right 1 Col: Simplified Recent Activities & Trails -->
            <div class="space-y-6">
                <div class="flex items-center justify-between pb-2 border-b">
                    <div>
                        <span class="text-xs uppercase font-bold tracking-wider text-primary">GPS & Activités</span>
                        <h3 class="text-xl font-serif font-bold text-foreground">Sorties récentes</h3>
                    </div>
                    <a href="/trails" class="text-xs text-primary hover:underline font-semibold">
                        Voir tout →
                    </a>
                </div>

                {#if recentTrails.length === 0}
                    <div class="p-6 rounded-2xl border bg-card/40 text-center space-y-2">
                        <i class="fa-solid fa-route text-2xl text-muted-foreground"></i>
                        <p class="text-xs text-muted-foreground">Aucune trace enregistrée pour le moment.</p>
                    </div>
                {:else}
                    <div class="space-y-3">
                        {#each recentTrails as trail}
                            {@const authorName = trail.expand?.author?.preferred_username || trail.expand?.author?.username || trail.author}
                            <a
                                href="/trail/view/@{authorName}/{trail.id}"
                                class="group block p-3.5 rounded-xl border bg-card hover:border-primary/60 transition-all shadow-2xs hover:shadow-xs"
                            >
                                <div class="flex items-start justify-between gap-3">
                                    <div class="min-w-0 flex-1 space-y-1">
                                        <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold uppercase">
                                            {#if trail.expand?.category?.name}
                                                <span class="text-primary">{trail.expand.category.name}</span>
                                                <span>·</span>
                                            {/if}
                                            <span>{trail.created ? new Date(trail.created).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span>
                                        </div>

                                        <h4 class="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                            {trail.name}
                                        </h4>

                                        {#if trail.location}
                                            <p class="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                <i class="fa-solid fa-location-dot text-[10px] text-muted-foreground/80"></i>
                                                {trail.location}
                                            </p>
                                        {/if}
                                    </div>

                                    <!-- Quick Metrics Badge -->
                                    <div class="text-right shrink-0">
                                        <span class="text-xs font-bold text-foreground block">
                                            {Math.round((trail.distance || 0) / 1000)} km
                                        </span>
                                        <span class="text-[11px] text-muted-foreground block">
                                            +{Math.round(trail.elevation_gain || 0)} m
                                        </span>
                                    </div>
                                </div>
                            </a>
                        {/each}
                    </div>
                {/if}

                <!-- Quick Help / Contribution Callout -->
                <div class="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <i class="fa-solid fa-lightbulb"></i> Le saviez-vous ?
                    </h4>
                    <p class="text-xs text-muted-foreground leading-relaxed">
                        Chaque trace importée depuis <strong>Strava</strong> ou <strong>Komoot</strong> peut être directement associée à un carnet de voyage pour composer une étape ou un périple complet.
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>

