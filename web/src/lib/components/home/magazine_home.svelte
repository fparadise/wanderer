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
            totalTrailsCount?: number;
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
    let totalTrailsCount = $derived(data.totalTrailsCount ?? (recentTrails.length || 0));

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
    <!-- 1. Featured Story Hero Banner -->
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

    <!-- 2. Main Magazine Stories (Full Width 3-column Grid) -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-input-border">
            <div>
                <span class="text-xs uppercase font-bold tracking-wider text-primary">Carnets de route & Récits</span>
                <h3 class="text-2xl sm:text-3xl font-serif font-bold text-content mt-0.5">Derniers récits d'aventures</h3>
            </div>

            <!-- Tag Filter Pills -->
            {#if allArticleTags.length > 0}
                <div class="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                    <button
                        type="button"
                        onclick={() => { selectedTagFilter = null; }}
                        class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 {selectedTagFilter === null ? 'bg-primary text-white border-primary shadow-xs' : 'bg-background text-content/70 hover:text-content border-input-border'}"
                    >
                        Tous les récits
                    </button>
                    {#each allArticleTags.slice(0, 6) as tag}
                        <button
                            type="button"
                            onclick={() => { selectedTagFilter = selectedTagFilter === tag ? null : tag; }}
                            class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 {selectedTagFilter === tag ? 'bg-primary text-white border-primary shadow-xs' : 'bg-background text-content/70 hover:text-content border-input-border'}"
                        >
                            #{tag}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        {#if filteredArticles.length === 0}
            <p class="text-sm text-content/60 italic py-16 text-center bg-input-background/40 {RADIUS.card} border border-dashed border-input-border">
                Aucun récit ne correspond à ce filtre.
            </p>
        {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {#each filteredArticles as article (article.id)}
                    <ArticleCard {article} variant="grid" />
                {/each}
            </div>
        {/if}
    </section>

    <!-- 3. Community Gateway: Map Counter Banner & Recent Field Activities -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div class="space-y-8">
            <!-- Map Banner with Community Stats Gateway -->
            <div class="relative overflow-hidden rounded-3xl border border-input-border bg-gradient-to-br from-primary/10 via-background to-input-background p-6 sm:p-8 lg:p-10 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
                <!-- Atmospheric background icon -->
                <div class="absolute -right-8 -bottom-8 opacity-10 pointer-events-none text-content">
                    <i class="fa-solid fa-map-location-dot text-[160px]"></i>
                </div>

                <div class="relative z-10 max-w-xl space-y-3">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary text-white shadow-xs">
                            <i class="fa-solid fa-compass"></i> Territoire & GPS
                        </span>
                        {#if totalTrailsCount > 0}
                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-background text-content border border-input-border shadow-2xs">
                                <i class="fa-solid fa-route text-primary"></i>
                                {totalTrailsCount} {totalTrailsCount > 1 ? 'itinéraires répertoriés' : 'itinéraire répertorié'}
                            </span>
                        {/if}
                    </div>

                    <h3 class="text-2xl sm:text-3xl font-serif font-bold text-content">
                        Explorez la carte interactive
                    </h3>
                    <p class="text-sm text-content/75 leading-relaxed">
                        Visualisez l'ensemble des traces enregistrées par la communauté, filtrez par massif ou discipline, et téléchargez les fichiers GPX pour vos prochaines sorties.
                    </p>
                </div>

                <div class="relative z-10 shrink-0">
                    <a
                        href="/map"
                        class="btn-primary py-3 px-6 rounded-2xl inline-flex items-center gap-3 font-bold shadow-md hover:scale-105 transition-all text-sm"
                    >
                        <i class="fa-solid fa-map-location-dot text-base"></i>
                        <span>Ouvrir la carte</span>
                        <i class="fa-solid fa-arrow-right text-xs"></i>
                    </a>
                </div>
            </div>

            <!-- Recent Community GPS Tracks Horizontal Grid -->
            {#if recentTrails.length > 0}
                <div class="space-y-4">
                    <div class="flex items-center justify-between pb-1">
                        <div>
                            <span class="text-xs uppercase font-bold tracking-wider text-primary">Activités récentes</span>
                            <h4 class="text-lg font-serif font-bold text-content">Dernières sorties enregistrées sur le terrain</h4>
                        </div>
                        <a href="/map" class="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
                            <span>Voir toutes les traces</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </a>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {#each recentTrails as trail (trail.id)}
                            {@const author = trail.expand?.author}
                            {@const authorName = author?.preferred_username || author?.username || "Aventurier"}
                            {@const authorAvatar = author?.icon ? getFileURL(author, author.icon) : `https://api.dicebear.com/7.x/initials/svg?seed=${authorName}`}
                            {@const activityDate = trail.date
                                ? new Date(trail.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                                : (trail.created ? new Date(trail.created).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')}
                            <a
                                href="/trail/view/@{authorName}/{trail.id}"
                                class="group block p-4 rounded-2xl border border-input-border bg-background hover:border-primary/60 transition-all shadow-2xs hover:shadow-xs space-y-3"
                            >
                                <!-- Author Header: Avatar, Username, GPX Activity Date -->
                                <div class="flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-2.5 min-w-0">
                                        <img
                                            src={authorAvatar}
                                            alt={authorName}
                                            class="w-6 h-6 rounded-full object-cover border border-input-border shrink-0"
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
                                <div class="space-y-1">
                                    <h5 class="text-sm font-semibold text-content group-hover:text-primary transition-colors truncate">
                                        {trail.name}
                                    </h5>
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

                                <!-- Quick Metrics Pill Bar -->
                                <div class="flex items-center justify-between pt-2 border-t border-input-border/50 text-xs">
                                    <span class="font-extrabold text-content flex items-center gap-1">
                                        <i class="fa-solid fa-route text-content/40 text-[10px]"></i>
                                        {formatDistance(trail.distance, { compact: true })}
                                    </span>
                                    <span class="font-semibold text-primary flex items-center gap-1">
                                        <i class="fa-solid fa-arrow-trend-up text-[10px]"></i>
                                        +{formatElevation(trail.elevation_gain)}
                                    </span>
                                </div>
                            </a>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </section>
</div>
