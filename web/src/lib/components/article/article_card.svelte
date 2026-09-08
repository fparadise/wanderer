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
        class="group relative {RADIUS.hero} overflow-hidden border border-input-border shadow-md hover:shadow-xl transition-all duration-500 bg-neutral-950 text-white min-h-[500px] lg:min-h-[580px] flex flex-col justify-between {extraClass}"
    >
        <!-- Background Cover Image & Atmospheric Bottom Gradient -->
        {#if coverUrl}
            <img
                src={coverUrl}
                alt={article.title}
                class="absolute inset-0 w-full h-full object-cover object-center opacity-95 group-hover:scale-105 transition-transform duration-1000"
            />
        {:else}
            <div class="absolute inset-0 bg-gradient-to-br from-primary/50 via-neutral-900 to-black"></div>
        {/if}
        <!-- Lighter, progressive gradient anchored at the bottom to protect text readability while keeping photo bright -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 via-50% to-transparent pointer-events-none"></div>

        <!-- Top Header: Badge "À la une" + tags / stats -->
        <div class="relative z-1 w-full flex flex-wrap items-center justify-between gap-3 p-6 sm:p-8 lg:p-10">
            <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-primary text-white shadow-md">
                    <i class="fa-solid fa-compass"></i> À la une
                </span>
                {#if article.tags && article.tags.length > 0}
                    {#each article.tags.slice(0, 2) as tag}
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/40 backdrop-blur-md text-white/90 border border-white/15">
                            #{tag}
                        </span>
                    {/each}
                {/if}
            </div>

            {#if summaryBadges.length > 0}
                <div class="hidden sm:flex items-center gap-2">
                    {#each summaryBadges as badge}
                        <span class="px-3 py-1 rounded-full text-[11px] font-semibold bg-black/40 backdrop-blur-md text-white/90 border border-white/15">
                            {badge}
                        </span>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Bottom Content Overlay (Spans full width, with readable text container) -->
        <div class="relative z-1 w-full p-6 sm:p-8 lg:p-10 space-y-6">
            <!-- Text area: limited to max-w-3xl (~768px) for optimal typography reading measure -->
            <div class="max-w-3xl space-y-3">
                <h2 class="text-3xl sm:text-4xl lg:text-5xl font-serif font-extrabold leading-tight tracking-tight group-hover:text-primary-light transition-colors drop-shadow-md">
                    {article.title}
                </h2>

                {#if article.intro}
                    <p class="text-sm sm:text-base text-white/85 font-serif italic line-clamp-3 leading-relaxed drop-shadow-xs max-w-2xl">
                        {article.intro}
                    </p>
                {/if}
            </div>

            <!-- Full-width Bottom Bar: Author info on left, CTA on right at the bottom edge -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/15">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-white/40 shadow-md shrink-0">
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
                        <p class="text-xs text-white/70">
                            {displayDate}
                        </p>
                    </div>
                </div>

                <span class="btn-primary text-xs py-2.5 px-5 rounded-full inline-flex items-center gap-2 group-hover:scale-105 transition-transform shadow-lg self-start sm:self-auto">
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
        class="group flex items-center gap-4 p-3 {RADIUS.card} border border-input-border bg-surface hover:border-primary/60 transition-all shadow-xs hover:shadow-sm {extraClass}"
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
        class="group {RADIUS.card} overflow-hidden border border-input-border bg-surface hover:border-primary/50 transition-all duration-300 flex flex-col shadow-xs hover:shadow-md {extraClass}"
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

            {#if summaryBadges.length > 0}
                <div class="absolute bottom-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
                    {#each summaryBadges.slice(0, 2) as badge}
                        <span class="bg-background/90 text-content text-[11px] font-bold px-2.5 py-0.5 rounded-md border border-input-border backdrop-blur-xs shadow-2xs">
                            {badge}
                        </span>
                    {/each}
                </div>
            {/if}
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
