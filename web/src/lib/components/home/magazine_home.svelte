<script lang="ts">
    import type { Article } from "$lib/models/article";
    import type { Trail } from "$lib/models/trail";
    import { currentUser } from "$lib/stores/user_store";
    import { formatDistance, formatElevation } from "$lib/util/format_util";
    import { getFileURL } from "$lib/util/file_util";
    import { RADIUS } from "$lib/config/design_system";
    import ArticleCard from "$lib/components/article/article_card.svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        data: {
            articles?: Article[];
            recentTrails?: Trail[];
        };
    }

    let { data }: Props = $props();

    let articles = $derived(data.articles || []);
    let featuredArticle = $derived.by(() => {
        if (articles.length === 0) return null;
        const explicitFeatured = articles.find((a) => a.featured);
        return explicitFeatured || articles[0];
    });
    let recentTrails = $derived(data.recentTrails || []);

    let selectedTagFilter: string | null = $state(null);

    let filteredArticles = $derived(
        selectedTagFilter
            ? articles.filter((a) => (a.tags || []).includes(selectedTagFilter!))
            : articles
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
    <!-- Featured Story Hero Banner -->
    {#if featuredArticle}
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ArticleCard article={featuredArticle} variant="featured" />
        </section>
    {:else}
        <!-- Fallback empty state if no articles exist yet -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
            <div class="max-w-xl mx-auto p-8 {RADIUS.card} border border-input-border bg-background shadow-xs space-y-4">
                <i class="fa-solid fa-book-open text-4xl text-primary"></i>
                <h2 class="text-2xl font-serif font-bold text-content">Bienvenue dans le Magazine</h2>
                <p class="text-sm text-content/70">
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

    <!-- Main Content Grid: Recent Stories (2 cols) & Recent GPS Trails (1 col) -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <!-- Left 2 Cols: Recent Magazine Stories -->
            <div class="lg:col-span-2 space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-input-border">
                    <div>
                        <span class="text-xs uppercase font-bold tracking-wider text-primary">Carnets de route</span>
                        <h3 class="text-2xl font-serif font-bold text-content">Derniers récits d'aventures</h3>
                    </div>

                    <!-- Tag Filter Pills -->
                    {#if allArticleTags.length > 0}
                        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                            <button
                                type="button"
                                onclick={() => { selectedTagFilter = null; }}
                                class="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 {selectedTagFilter === null ? 'bg-primary text-white border-primary' : 'bg-background text-content/70 hover:text-content border-input-border'}"
                            >
                                Tous
                            </button>
                            {#each allArticleTags.slice(0, 6) as tag}
                                <button
                                    type="button"
                                    onclick={() => { selectedTagFilter = selectedTagFilter === tag ? null : tag; }}
                                    class="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 {selectedTagFilter === tag ? 'bg-primary text-white border-primary' : 'bg-background text-content/70 hover:text-content border-input-border'}"
                                >
                                    #{tag}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>

                {#if filteredArticles.length === 0}
                    <p class="text-sm text-content/60 italic py-12 text-center bg-input-background/40 {RADIUS.card} border border-dashed border-input-border">
                        Aucun autre récit ne correspond à ce filtre.
                    </p>
                {:else}
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {#each filteredArticles as article (article.id)}
                            <ArticleCard {article} variant="grid" />
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Right 1 Col: Recent Community GPS Tracks -->
            <div class="space-y-6">
                <div class="flex items-center justify-between pb-2 border-b border-input-border">
                    <div>
                        <span class="text-xs uppercase font-bold tracking-wider text-primary">GPS & Activités</span>
                        <h3 class="text-xl font-serif font-bold text-content">Sorties récentes</h3>
                    </div>
                    <a href="/map" class="text-xs text-primary hover:underline font-semibold">
                        Voir la carte →
                    </a>
                </div>

                {#if recentTrails.length === 0}
                    <div class="p-6 {RADIUS.card} border border-input-border bg-background text-center space-y-2">
                        <i class="fa-solid fa-route text-2xl text-content/40"></i>
                        <p class="text-xs text-content/60">Aucune trace enregistrée pour le moment.</p>
                    </div>
                {:else}
                    <div class="space-y-3">
                        {#each recentTrails as trail (trail.id)}
                            {@const author = trail.expand?.author}
                            {@const authorName = author?.preferred_username || author?.username || "Aventurier"}
                            {@const authorAvatar = author?.icon ? getFileURL(author, author.icon) : `https://api.dicebear.com/7.x/initials/svg?seed=${authorName}`}
                            {@const activityDate = trail.date
                                ? new Date(trail.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                                : (trail.created ? new Date(trail.created).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')}
                            <a
                                href="/trail/view/@{authorName}/{trail.id}"
                                class="group block p-3.5 rounded-xl border border-input-border bg-background hover:border-primary/60 transition-all shadow-2xs hover:shadow-xs space-y-2.5"
                            >
                                <!-- Author Header: Avatar, Username, GPX Activity Date -->
                                <div class="flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-2 min-w-0">
                                        <img
                                            src={authorAvatar}
                                            alt={authorName}
                                            class="w-5 h-5 rounded-full object-cover border border-input-border shrink-0"
                                        />
                                        <span class="text-xs font-bold text-content truncate group-hover:text-primary transition-colors">
                                            @{authorName}
                                        </span>
                                    </div>
                                    <span class="text-[11px] text-content/60 shrink-0 font-medium">
                                        {activityDate}
                                    </span>
                                </div>

                                <!-- Trail Title & Category -->
                                <div class="flex items-start justify-between gap-3">
                                    <div class="min-w-0 flex-1 space-y-0.5">
                                        <h4 class="text-sm font-semibold text-content group-hover:text-primary transition-colors truncate">
                                            {trail.name}
                                        </h4>
                                        <div class="flex items-center gap-2 text-[11px] text-content/60">
                                            {#if trail.expand?.category?.name}
                                                <span class="text-primary font-semibold">{trail.expand.category.name}</span>
                                            {/if}
                                            {#if trail.location}
                                                {#if trail.expand?.category?.name}<span>·</span>{/if}
                                                <span class="truncate flex items-center gap-1">
                                                    <i class="fa-solid fa-location-dot text-[9px] text-content/40"></i>
                                                    {trail.location}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>

                                    <!-- Quick Metrics -->
                                    <div class="text-right shrink-0">
                                        <span class="text-xs font-bold text-content block">
                                            {formatDistance(trail.distance, { compact: true })}
                                        </span>
                                        <span class="text-[11px] font-semibold text-primary block">
                                            +{formatElevation(trail.elevation_gain)}
                                        </span>
                                    </div>
                                </div>
                            </a>
                        {/each}
                    </div>
                {/if}

                <!-- Contribution Callout banner -->
                <div class="p-5 {RADIUS.card} bg-primary/5 border border-primary/20 space-y-3">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <i class="fa-solid fa-lightbulb"></i> Le saviez-vous ?
                    </h4>
                    <p class="text-xs text-content/80 leading-relaxed">
                        Chaque trace importée depuis <strong>Strava</strong> ou <strong>Komoot</strong> peut être directement associée à un carnet de voyage pour composer une étape ou un périple complet.
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>
