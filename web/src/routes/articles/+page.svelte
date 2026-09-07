<script lang="ts">
    import { currentUser } from "$lib/stores/user_store";
    import { getFileURL } from "$lib/util/file_util";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    let articles = $derived(data.articles || []);
    let featuredArticle = $derived(articles.length > 0 ? articles[0] : null);
    let restArticles = $derived(articles.length > 1 ? articles.slice(1) : []);
</script>

<svelte:head>
    <title>Le Magazine | Récits d'aventures & Itinéraires</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
    <!-- Header banner -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-8 border-b">
        <div class="space-y-2">
            <span class="text-xs uppercase font-bold tracking-widest text-primary">Carnets d'itinéraires</span>
            <h1 class="text-4xl sm:text-5xl font-serif font-extrabold text-foreground tracking-tight">
                Le Magazine
            </h1>
            <p class="text-base text-muted-foreground max-w-xl font-serif italic">
                Récits illustrés, expéditions multi-jours et retours d'expérience associés à nos traces GPS.
            </p>
        </div>

        {#if $currentUser}
            <a
                href="/articles/new"
                class="btn-primary py-3 px-5 flex items-center justify-center gap-2 shrink-0 self-start sm:self-auto shadow-sm"
            >
                <i class="fa-solid fa-feather"></i>
                <span>Rédiger un récit</span>
            </a>
        {/if}
    </div>

    {#if articles.length === 0}
        <!-- Empty State -->
        <div class="py-20 text-center max-w-lg mx-auto space-y-6">
            <div class="w-20 h-20 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl">
                <i class="fa-solid fa-book-open"></i>
            </div>
            <div class="space-y-2">
                <h2 class="text-2xl font-serif font-bold text-foreground">Aucun article pour le moment</h2>
                <p class="text-sm text-muted-foreground">
                    Soyez le premier à partager une aventure en associant vos itinéraires GPS à un récit illustré.
                </p>
            </div>
            {#if $currentUser}
                <a href="/articles/new" class="btn-primary inline-flex items-center gap-2">
                    <i class="fa-solid fa-plus"></i>
                    Créer le premier article
                </a>
            {:else}
                <a href="/login" class="btn-secondary inline-flex items-center gap-2">
                    Connectez-vous pour rédiger
                </a>
            {/if}
        </div>
    {:else}
        <!-- Featured Article Hero Card -->
        {#if featuredArticle}
            {@const coverUrl = featuredArticle.hero_images && featuredArticle.hero_images.length > 0 ? getFileURL(featuredArticle, featuredArticle.hero_images[0]) : null}
            {@const author = featuredArticle.expand?.author}
            <a
                href="/articles/{featuredArticle.id}"
                class="group block relative rounded-3xl overflow-hidden border shadow-sm hover:shadow-lg transition-all duration-300 bg-card"
            >
                <div class="grid grid-cols-1 lg:grid-cols-12 min-h-[440px]">
                    <div class="lg:col-span-7 relative h-72 lg:h-full overflow-hidden bg-neutral-900">
                        {#if coverUrl}
                            <img
                                src={coverUrl}
                                alt={featuredArticle.title}
                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                        {:else}
                            <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-background">
                                <i class="fa-solid fa-mountain-sun text-6xl text-primary/40"></i>
                            </div>
                        {/if}
                        <div class="absolute top-4 left-4 bg-primary text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                            À la une
                        </div>
                    </div>

                    <div class="lg:col-span-5 p-8 sm:p-10 flex flex-col justify-between space-y-6">
                        <div class="space-y-4">
                            <!-- Metrics Badges -->
                            <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                                {#if featuredArticle.total_distance > 0}
                                    <span class="bg-card border px-2.5 py-1 rounded-lg">
                                        <i class="fa-solid fa-route text-primary mr-1"></i>{featuredArticle.total_distance} km
                                    </span>
                                {/if}
                                {#if featuredArticle.total_elevation_gain > 0}
                                    <span class="bg-card border px-2.5 py-1 rounded-lg">
                                        <i class="fa-solid fa-mountain text-primary mr-1"></i>+{featuredArticle.total_elevation_gain} m
                                    </span>
                                {/if}
                                {#if featuredArticle.total_days > 0}
                                    <span class="bg-card border px-2.5 py-1 rounded-lg">
                                        <i class="fa-solid fa-calendar text-primary mr-1"></i>{featuredArticle.total_days} {featuredArticle.total_days > 1 ? 'jours' : 'jour'}
                                    </span>
                                {/if}
                            </div>

                            <h2 class="text-2xl sm:text-3xl font-serif font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                                {featuredArticle.title}
                            </h2>

                            {#if featuredArticle.intro}
                                <p class="text-sm text-muted-foreground line-clamp-3 font-serif italic leading-relaxed">
                                    {featuredArticle.intro}
                                </p>
                            {/if}
                        </div>

                        <!-- Author Footer -->
                        <div class="flex items-center justify-between pt-4 border-t border-border/60">
                            <div class="flex items-center gap-3">
                                {#if author}
                                    <div class="w-9 h-9 rounded-full overflow-hidden border border-primary/50">
                                        <img
                                            src={author.icon ? getFileURL(author, author.icon) : `https://api.dicebear.com/7.x/initials/svg?seed=${author.preferred_username || 'A'}`}
                                            alt={author.preferred_username || author.username}
                                            class="w-full h-full object-cover"
                                        />
                                    </div>
                                    <span class="text-xs font-bold text-foreground">
                                        {author.preferred_username || author.username}
                                    </span>
                                {/if}
                            </div>
                            <span class="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                Lire le récit <i class="fa-solid fa-arrow-right text-[10px]"></i>
                            </span>
                        </div>
                    </div>
                </div>
            </a>
        {/if}

        <!-- Rest of Articles Grid -->
        {#if restArticles.length > 0}
            <div class="space-y-6 pt-4">
                <h3 class="text-xl font-serif font-bold text-foreground">Tous les récits</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {#each restArticles as article}
                        {@const coverUrl = article.hero_images && article.hero_images.length > 0 ? getFileURL(article, article.hero_images[0]) : null}
                        {@const author = article.expand?.author}
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
                                {#if article.total_distance > 0}
                                    <div class="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-md">
                                        {article.total_distance} km · +{article.total_elevation_gain} m
                                    </div>
                                {/if}
                            </div>

                            <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
                                <div class="space-y-2">
                                    <h4 class="text-lg font-serif font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                        {article.title}
                                    </h4>
                                    {#if article.intro}
                                        <p class="text-xs text-muted-foreground line-clamp-2 italic font-serif">
                                            {article.intro}
                                        </p>
                                    {/if}
                                </div>

                                <div class="flex items-center justify-between pt-3 border-t border-border/60 text-xs text-muted-foreground">
                                    <span>{author?.preferred_username || author?.username || "Aventurier"}</span>
                                    <span>{new Date(article.date || article.created || Date.now()).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>
                                </div>
                            </div>
                        </a>
                    {/each}
                </div>
            </div>
        {/if}
    {/if}
</div>
