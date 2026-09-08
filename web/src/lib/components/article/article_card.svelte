<script lang="ts">
    import type { Article } from "$lib/models/article";
    import { getFileURL } from "$lib/util/file_util";
    import { RADIUS, formatArticleSummary } from "$lib/config/design_system";
    import DifficultyBadge from "./difficulty_badge.svelte";

    interface Props {
        article: Article;
        variant?: "grid" | "featured" | "compact";
        class?: string;
    }

    let {
        article,
        variant = "grid",
        class: extraClass = "",
    }: Props = $props();

    let coverUrl = $derived(
        article.hero_images && article.hero_images.length > 0
            ? getFileURL(article, article.hero_images[0], variant === "featured" ? undefined : "600x0")
            : null
    );

    let author = $derived(article.expand?.author);
    let authorName = $derived(author?.preferred_username || author?.username || "Auteur");
    let authorAvatar = $derived(
        author?.icon
            ? getFileURL(author, author.icon)
            : `https://api.dicebear.com/7.x/initials/svg?seed=${authorName}`
    );

    let summaryBadges = $derived(formatArticleSummary(article));
    let displayDate = $derived(
        new Date(article.date || article.created || Date.now()).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
        })
    );
</script>

{#if variant === "featured"}
    <!-- Large Featured Hero Card for Magazine Front Page -->
    <a
        href="/articles/{article.id}"
        class="group block relative {RADIUS.hero} overflow-hidden border border-input-border shadow-md hover:shadow-xl transition-all duration-500 bg-neutral-950 text-white min-h-[480px] lg:min-h-[560px] {extraClass}"
    >
        <!-- Background Cover Image & Atmospheric Gradients -->
        {#if coverUrl}
            <img
                src={coverUrl}
                alt={article.title}
                class="absolute inset-0 w-full h-full object-cover object-center opacity-80 group-hover:scale-105 transition-transform duration-1000"
            />
        {:else}
            <div class="absolute inset-0 bg-gradient-to-br from-primary/50 via-neutral-900 to-black"></div>
        {/if}
        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent"></div>

        <!-- Hero Content Overlay -->
        <div class="relative h-full flex flex-col justify-end p-6 sm:p-10 lg:p-12 max-w-3xl space-y-5">
            <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-primary text-white shadow-lg">
                    <i class="fa-solid fa-compass"></i> À la une
                </span>
                {#if article.technical_difficulty}
                    <DifficultyBadge level={article.technical_difficulty} size="compact" />
                {/if}
                {#each summaryBadges as badge}
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/60 backdrop-blur-md text-white/90">
                        {badge}
                    </span>
                {/each}
            </div>

            <h2 class="text-3xl sm:text-4xl lg:text-5xl font-serif font-extrabold leading-tight tracking-tight group-hover:text-primary-light transition-colors drop-shadow-md">
                {article.title}
            </h2>

            {#if article.intro}
                <p class="text-sm sm:text-base text-white/80 font-serif italic line-clamp-3 leading-relaxed drop-shadow-xs">
                    {article.intro}
                </p>
            {/if}

            <!-- Author info & action button -->
            <div class="flex items-center justify-between pt-4 border-t border-white/20">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full overflow-hidden border-2 border-primary shrink-0 shadow-md">
                        <img
                            src={authorAvatar}
                            alt={authorName}
                            class="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <p class="text-sm font-bold text-white leading-tight">
                            {authorName}
                        </p>
                        <p class="text-xs text-white/60">
                            {displayDate}
                        </p>
                    </div>
                </div>

                <span class="btn-primary text-xs py-2 px-4.5 rounded-full inline-flex items-center gap-2 group-hover:translate-x-1 transition-transform shadow-lg">
                    <span>Lire le récit</span>
                    <i class="fa-solid fa-arrow-right text-[10px]"></i>
                </span>
            </div>
        </div>
    </a>
{:else if variant === "compact"}
    <!-- Compact Horizontal Card (e.g. for sidebars or search results) -->
    <a
        href="/articles/{article.id}"
        class="group flex items-center gap-4 p-3 {RADIUS.card} border border-input-border bg-background hover:border-primary/60 transition-all shadow-2xs hover:shadow-xs {extraClass}"
    >
        <div class="w-20 h-20 rounded-xl overflow-hidden bg-input-background shrink-0 relative">
            {#if coverUrl}
                <img
                    src={coverUrl}
                    alt={article.title}
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
            {:else}
                <div class="w-full h-full flex items-center justify-center text-content/30">
                    <i class="fa-solid fa-mountain text-lg"></i>
                </div>
            {/if}
        </div>
        <div class="min-w-0 flex-1 space-y-1">
            <h4 class="text-sm font-serif font-bold text-content group-hover:text-primary transition-colors truncate">
                {article.title}
            </h4>
            <p class="text-xs text-content/70 flex items-center gap-2">
                <span>{authorName}</span>
                <span>·</span>
                <span>{displayDate}</span>
            </p>
        </div>
    </a>
{:else}
    <!-- Standard Grid Card for Magazine Front & Articles Index -->
    <a
        href="/articles/{article.id}"
        class="group {RADIUS.card} overflow-hidden border border-input-border bg-background hover:border-primary/50 transition-all duration-300 flex flex-col shadow-2xs hover:shadow-md {extraClass}"
    >
        <div class="aspect-16/10 relative overflow-hidden bg-input-background">
            {#if coverUrl}
                <img
                    src={coverUrl}
                    alt={article.title}
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
            {:else}
                <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-background">
                    <i class="fa-solid fa-mountain text-4xl text-primary/30"></i>
                </div>
            {/if}

            <div class="absolute bottom-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
                {#if article.technical_difficulty}
                    <DifficultyBadge level={article.technical_difficulty} size="compact" />
                {/if}
                {#each summaryBadges.slice(0, 2) as badge}
                    <span class="bg-background/90 text-content text-[11px] font-bold px-2 py-0.5 rounded-md border border-input-border backdrop-blur-xs shadow-2xs">
                        {badge}
                    </span>
                {/each}
            </div>
        </div>

        <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
            <div class="space-y-2">
                {#if article.tags && article.tags.length > 0}
                    <div class="flex flex-wrap gap-1">
                        {#each article.tags.slice(0, 3) as tag}
                            <span class="text-[10px] uppercase font-bold text-primary">#{tag}</span>
                        {/each}
                    </div>
                {/if}

                <h4 class="text-base sm:text-lg font-serif font-bold text-content group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                    {article.title}
                </h4>

                {#if article.intro}
                    <p class="text-xs text-content/70 line-clamp-2 italic font-serif leading-relaxed">
                        {article.intro}
                    </p>
                {/if}
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-input-border text-xs text-content/70">
                <span class="font-medium truncate max-w-[140px]">{authorName}</span>
                <span class="shrink-0">{displayDate}</span>
            </div>
        </div>
    </a>
{/if}
