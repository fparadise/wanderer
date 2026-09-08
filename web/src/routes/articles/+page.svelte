<script lang="ts">
    import { currentUser } from "$lib/stores/user_store";
    import ArticleCard from "$lib/components/article/article_card.svelte";
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
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-8 border-b border-input-border">
        <div class="space-y-2">
            <span class="text-xs uppercase font-bold tracking-widest text-primary">Carnets d'itinéraires</span>
            <h1 class="text-4xl sm:text-5xl font-serif font-extrabold text-content tracking-tight">
                Le Magazine
            </h1>
            <p class="text-base text-content/70 max-w-xl font-serif italic">
                Récits illustrés, expéditions multi-jours et retours d'expérience associés à nos traces GPS.
            </p>
        </div>

        {#if $currentUser}
            <a
                href="/articles/new"
                class="btn-primary py-3 px-5 flex items-center justify-center gap-2 shrink-0 self-start sm:self-auto shadow-xs"
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
                <h2 class="text-2xl font-serif font-bold text-content">Aucun article pour le moment</h2>
                <p class="text-sm text-content/70">
                    Soyez le premier à partager une aventure en associant vos itinéraires GPS à un récit illustré.
                </p>
            </div>
            {#if $currentUser}
                <a href="/articles/new" class="btn-primary inline-flex items-center gap-2">
                    <i class="fa-solid fa-plus"></i>
                    <span>Créer le premier article</span>
                </a>
            {:else}
                <a href="/login" class="btn-secondary inline-flex items-center gap-2">
                    <span>Connectez-vous pour rédiger</span>
                </a>
            {/if}
        </div>
    {:else}
        <!-- Featured Article Hero Card -->
        {#if featuredArticle}
            <ArticleCard article={featuredArticle} variant="featured" />
        {/if}

        <!-- Rest of Articles Grid -->
        {#if restArticles.length > 0}
            <div class="space-y-6 pt-4">
                <h3 class="text-xl font-serif font-bold text-content">Tous les récits</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {#each restArticles as article (article.id)}
                        <ArticleCard {article} variant="grid" />
                    {/each}
                </div>
            </div>
        {/if}
    {/if}
</div>
