<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { slide } from "svelte/transition";
    import { currentUser } from "$lib/stores/user_store";
    import ArticleCard from "$lib/components/article/article_card.svelte";
    import Select, { type SelectItem } from "$lib/components/base/select.svelte";
    import DoubleSlider from "$lib/components/base/double_slider.svelte";
    import { TECHNICAL_DIFFICULTY_LEVELS } from "$lib/models/editorial_tags";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    let articles = $derived(data.articles || []);
    let filter = $derived(data.filter || {});
    let totalItems = $derived(data.totalItems || articles.length);

    let activeTags = $derived(
        filter.tags && filter.tags.length > 0
            ? filter.tags
            : filter.tag
              ? filter.tag.split(",").map((t) => t.trim()).filter(Boolean)
              : []
    );
    let activeQ = $derived(filter.q || "");
    let activeDifficultyMin = $derived(filter.difficultyMin ?? 1);
    let activeDifficultyMax = $derived(filter.difficultyMax ?? 5);
    let isDifficultyFiltered = $derived(activeDifficultyMin > 1 || activeDifficultyMax < 5);
    let totalActiveFilters = $derived(activeTags.length + (isDifficultyFiltered ? 1 : 0));
    let activeSort = $derived(filter.sort || "-created");

    let isFiltered = $derived(
        Boolean(
            activeTags.length > 0 ||
            activeQ.trim() ||
            isDifficultyFiltered ||
            (activeSort && activeSort !== "-created")
        )
    );

    let featuredArticle = $derived(
        !isFiltered && articles.length > 0 ? articles[0] : null
    );
    let restArticles = $derived(
        !isFiltered && articles.length > 1
            ? articles.slice(1)
            : isFiltered
              ? articles
              : []
    );

    let isFilterPanelOpen = $state(false);
    let showAllTags = $state(false);

    let sliderMin = $state(1);
    let sliderMax = $state(5);
    $effect(() => {
        sliderMin = filter.difficultyMin ?? 1;
        sliderMax = filter.difficultyMax ?? 5;
    });

    const DIFFICULTY_CONFIG: Record<
        number,
        {
            name: string;
            solid: string;
            outline: string;
            text: string;
        }
    > = {
        1: {
            name: "Très roulant",
            solid: "bg-emerald-500 border-emerald-500 ring-2 ring-emerald-500/20",
            outline: "border-2 border-emerald-500 bg-transparent opacity-45",
            text: "text-emerald-600 dark:text-emerald-400",
        },
        2: {
            name: "Facile",
            solid: "bg-blue-500 border-blue-500 ring-2 ring-blue-500/20",
            outline: "border-2 border-blue-500 bg-transparent opacity-45",
            text: "text-blue-600 dark:text-blue-400",
        },
        3: {
            name: "Modéré",
            solid: "bg-orange-500 border-orange-500 ring-2 ring-orange-500/20",
            outline: "border-2 border-orange-500 bg-transparent opacity-45",
            text: "text-orange-600 dark:text-orange-400",
        },
        4: {
            name: "Difficile",
            solid: "bg-red-500 border-red-500 ring-2 ring-red-500/20",
            outline: "border-2 border-red-500 bg-transparent opacity-45",
            text: "text-red-600 dark:text-red-400",
        },
        5: {
            name: "Très engagé",
            solid: "bg-neutral-950 dark:bg-black border-2 border-black dark:border-white ring-2 ring-neutral-400/50 dark:ring-white/80 shadow-xs",
            outline: "border-2 border-black dark:border-white/70 bg-transparent opacity-45",
            text: "text-neutral-900 dark:text-neutral-100 font-extrabold",
        },
    };

    let tagsContainerEl: HTMLElement | null = $state(null);
    let visibleLimit = $state(999);
    let hasOverflow = $state(false);

    function computeTagsOverflow() {
        if (!tagsContainerEl) return;
        const pillElements = Array.from(
            tagsContainerEl.querySelectorAll<HTMLElement>(".tag-pill-item")
        );
        if (pillElements.length === 0) {
            hasOverflow = false;
            visibleLimit = sortedTags.length;
            return;
        }

        // Momentarily remove inline display override for accurate layout calculation
        pillElements.forEach((p) => {
            p.style.display = "";
        });

        const row1Top = pillElements[0].offsetTop;
        let row2Top: number | null = null;
        for (const p of pillElements) {
            if (p.offsetTop > row1Top + 6) {
                row2Top = p.offsetTop;
                break;
            }
        }

        if (row2Top === null) {
            hasOverflow = false;
            visibleLimit = sortedTags.length;
            return;
        }

        const firstRow3Idx = pillElements.findIndex((p) => p.offsetTop > row2Top! + 6);
        if (firstRow3Idx === -1) {
            hasOverflow = false;
            visibleLimit = sortedTags.length;
        } else {
            hasOverflow = true;
            // Leave space for the inline "+N" button at the end of row 2
            visibleLimit = Math.max(1, firstRow3Idx - 1);
        }
    }

    $effect(() => {
        if (sortedTags && isFilterPanelOpen) {
            requestAnimationFrame(() => {
                computeTagsOverflow();
            });
        }
    });

    onMount(() => {
        if (activeTags.length > 0 || isDifficultyFiltered) {
            isFilterPanelOpen = true;
        }
    });

    const sortItems: SelectItem[] = [
        { text: "Plus récents", value: "-created" },
        { text: "Date d'expédition", value: "-date" },
        { text: "Distance (décroissante)", value: "-total_distance" },
        { text: "Distance (croissante)", value: "total_distance" },
        { text: "Dénivelé positif", value: "-total_elevation_gain" },
    ];

    const POPULAR_TAGS = [
        "Bikepacking",
        "Gravel",
        "Ultra-distance",
        "Alpes",
        "Pyrénées",
        "Massif Central",
        "Bivouac",
        "En autonomie",
        "Cols mythiques",
        "Micro-aventure",
    ];

    let allTags = $derived.by(() => {
        const fromArticles = articles.flatMap((a) => a.tags || []);
        const set = new Set([...POPULAR_TAGS, ...fromArticles]);
        for (const t of activeTags) {
            set.add(t);
        }
        return Array.from(set);
    });

    let sortedTags = $derived.by(() => {
        const selected = allTags.filter((t) =>
            activeTags.some((at) => at.toLowerCase() === t.toLowerCase())
        );
        const unselected = allTags.filter(
            (t) => !activeTags.some((at) => at.toLowerCase() === t.toLowerCase())
        );
        return [...selected, ...unselected];
    });

    let searchInputValue = $state("");
    $effect(() => {
        searchInputValue = filter.q || "";
    });

    let searchDebounceTimer: any = null;
    function handleSearchInput(e: Event) {
        const val = (e.target as HTMLInputElement).value;
        searchInputValue = val;
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            applyFilters({ q: val });
        }, 250);
    }

    function clearSearch() {
        searchInputValue = "";
        applyFilters({ q: "" });
    }

    function toggleTag(tag: string) {
        const normalized = tag.trim().toLowerCase();
        let nextTags: string[];
        if (activeTags.some((t) => t.toLowerCase() === normalized)) {
            nextTags = activeTags.filter((t) => t.toLowerCase() !== normalized);
        } else {
            nextTags = [...activeTags, tag.trim()];
        }
        applyFilters({ tags: nextTags });
    }

    function applyFilters(updates: {
        tags?: string[];
        difficultyMin?: number;
        difficultyMax?: number;
        q?: string;
        sort?: string;
    }) {
        const nextTags = updates.tags !== undefined ? updates.tags : activeTags;
        const nextMin = updates.difficultyMin !== undefined ? updates.difficultyMin : activeDifficultyMin;
        const nextMax = updates.difficultyMax !== undefined ? updates.difficultyMax : activeDifficultyMax;
        const nextQ = updates.q !== undefined ? updates.q : activeQ;
        const nextSort = updates.sort !== undefined ? updates.sort : activeSort;

        const params = new URLSearchParams();
        if (nextTags.length > 0) params.set("tag", nextTags.join(","));
        if (nextMin > 1 || nextMax < 5) {
            params.set("difficulty", `${nextMin}-${nextMax}`);
        }
        if (nextQ && nextQ.trim()) params.set("q", nextQ.trim());
        if (nextSort && nextSort !== "-created") params.set("sort", nextSort);

        const queryString = params.toString();
        goto(`/articles${queryString ? `?${queryString}` : ""}`, {
            keepFocus: true,
            noScroll: true,
        });
    }

    function resetAllFilters() {
        searchInputValue = "";
        goto("/articles", { keepFocus: true, noScroll: true });
    }
</script>

<svelte:window onresize={computeTagsOverflow} />

<svelte:head>
    <title>Le Magazine | Récits d'aventures & Itinéraires</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
    <!-- Header banner -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-input-border">
        <div class="space-y-2">
            <span class="text-xs uppercase font-bold tracking-widest text-primary">Récits & Traces</span>
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

    <!-- Filter & Search Toolbar with Progressive Disclosure -->
    <div class="space-y-3 bg-surface p-4 sm:p-5 rounded-2xl border border-input-border shadow-2xs">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <!-- Search bar -->
            <div class="relative flex-1">
                <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-content/40 text-sm"></i>
                <input
                    type="text"
                    value={searchInputValue}
                    oninput={handleSearchInput}
                    placeholder="Rechercher par titre, destination, mot-clé..."
                    class="w-full pl-10 pr-9 py-2.5 rounded-xl border border-input-border bg-input-background text-content placeholder:text-content/40 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                {#if searchInputValue}
                    <button
                        type="button"
                        onclick={clearSearch}
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-content/40 hover:text-content text-xs cursor-pointer p-1"
                        aria-label="Effacer la recherche"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                {/if}
            </div>

            <!-- Filter Toggle & Sort Select -->
            <div class="flex items-center gap-2.5">
                <button
                    type="button"
                    onclick={() => (isFilterPanelOpen = !isFilterPanelOpen)}
                    class="px-3.5 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all cursor-pointer shrink-0 {isFilterPanelOpen
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : totalActiveFilters > 0
                          ? 'bg-primary/10 text-primary border-primary/30 font-semibold'
                          : 'bg-input-background text-content/80 hover:text-content border-input-border hover:bg-input-background/80'}"
                    aria-expanded={isFilterPanelOpen}
                >
                    <i class="fa-solid fa-sliders text-xs"></i>
                    <span>Filtres</span>
                    {#if totalActiveFilters > 0}
                        <span class="inline-flex items-center justify-center w-5 h-5 text-[11px] font-bold rounded-full {isFilterPanelOpen ? 'bg-white text-primary' : 'bg-primary text-white'}">
                            {totalActiveFilters}
                        </span>
                    {/if}
                </button>

                <div class="w-44 sm:w-48 shrink-0">
                    <Select
                        items={sortItems}
                        value={activeSort}
                        onchange={(val) => applyFilters({ sort: val })}
                        extraClasses="w-full text-xs rounded-xl"
                    />
                </div>
            </div>
        </div>

        <!-- Expandable Collapsible Filter Drawer -->
        {#if isFilterPanelOpen}
            <div transition:slide={{ duration: 200 }} class="pt-4 mt-2 border-t border-input-border/60 space-y-6">
                <!-- Difficulty Range Slider (DoubleSlider 1 à 5 with max-w-lg desktop width) -->
                <div class="space-y-4 max-w-lg">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2.5">
                            <span class="text-sm font-bold uppercase tracking-wider text-content/80">
                                Difficulté technique
                            </span>
                            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full {isDifficultyFiltered ? 'bg-primary text-white shadow-2xs' : 'bg-input-background text-content/70 border border-input-border'}">
                                {#if sliderMin === 1 && sliderMax === 5}
                                    Tous niveaux (1 à 5)
                                {:else if sliderMin === sliderMax}
                                    Niveau {sliderMin} uniquement
                                {:else}
                                    Niveau {sliderMin} à {sliderMax}
                                {/if}
                            </span>
                        </div>
                        {#if isDifficultyFiltered}
                            <button
                                type="button"
                                onclick={() => applyFilters({ difficultyMin: 1, difficultyMax: 5 })}
                                class="text-xs text-content/60 hover:text-primary transition-colors cursor-pointer"
                            >
                                Réinitialiser
                            </button>
                        {/if}
                    </div>

                    <div class="px-2 pt-1 pb-1">
                        <DoubleSlider
                            minValue={1}
                            maxValue={5}
                            step={1}
                            bind:currentMin={sliderMin}
                            bind:currentMax={sliderMax}
                            onupdate={([min, max]) => {
                                sliderMin = min;
                                sliderMax = max;
                            }}
                            onset={([min, max]) => {
                                applyFilters({ difficultyMin: min, difficultyMax: max });
                            }}
                        />

                        <!-- Step Markers (1 to 5) with solid/outline rings & authentic labels -->
                        <div class="flex justify-between items-start pt-2 text-content select-none">
                            {#each [1, 2, 3, 4, 5] as lvl}
                                {@const cfg = DIFFICULTY_CONFIG[lvl]}
                                {@const isInRange = lvl >= sliderMin && lvl <= sliderMax}
                                <div class="flex flex-col items-center gap-1 w-14 text-center">
                                    <span class="w-3.5 h-3.5 rounded-full transition-all duration-200 {isInRange ? cfg.solid : cfg.outline}"></span>
                                    <span class="text-sm font-bold transition-colors {isInRange ? cfg.text : 'text-content/40'}">{lvl}</span>
                                    <span class="text-xs font-medium transition-colors {isInRange ? 'text-content/80' : 'text-content/40'} leading-tight">
                                        {cfg.name}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>

                <!-- Tags Selector (cumulative in AND logic, multi-line with inline overflow button on row 2) -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-bold uppercase tracking-wider text-content/80">
                                Thématiques & Mots-clés
                            </span>
                            {#if activeTags.length > 1}
                                <span class="text-[11px] text-content/50 italic">(intersection : tous les critères)</span>
                            {/if}
                        </div>
                        {#if activeTags.length > 0}
                            <button
                                type="button"
                                onclick={() => applyFilters({ tags: [] })}
                                class="text-xs text-content/60 hover:text-primary transition-colors cursor-pointer"
                            >
                                Désélectionner tout
                            </button>
                        {/if}
                    </div>

                    <div
                        bind:this={tagsContainerEl}
                        class="flex flex-wrap gap-1.5 transition-all duration-200"
                    >
                        {#each sortedTags as tag, i}
                            {@const isSelected = activeTags.some((t) => t.toLowerCase() === tag.toLowerCase())}
                            {@const isVisible = showAllTags || !hasOverflow || i < visibleLimit}
                            <button
                                type="button"
                                onclick={() => toggleTag(tag)}
                                class="tag-pill-item px-3 py-1.5 rounded-full text-xs transition-all shrink-0 cursor-pointer {isVisible ? '' : '!hidden'} {isSelected
                                    ? 'bg-primary text-white font-semibold shadow-xs'
                                    : 'bg-input-background/60 hover:bg-input-background text-content/80 hover:text-content border border-input-border/70 font-medium'}"
                            >
                                {tag}
                            </button>
                        {/each}

                        {#if hasOverflow && !showAllTags}
                            <button
                                type="button"
                                onclick={() => (showAllTags = true)}
                                class="px-2.5 py-1.5 rounded-full text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 shadow-2xs"
                                title="Afficher toutes les thématiques"
                            >
                                <span>+{sortedTags.length - visibleLimit}</span>
                                <i class="fa-solid fa-chevron-down text-[10px]"></i>
                            </button>
                        {:else if hasOverflow && showAllTags}
                            <button
                                type="button"
                                onclick={() => (showAllTags = false)}
                                class="px-2.5 py-1.5 rounded-full text-xs font-semibold text-content/70 hover:text-content bg-input-background hover:bg-input-background/80 border border-input-border transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                                title="Réduire l'affichage"
                            >
                                <span>Réduire</span>
                                <i class="fa-solid fa-chevron-up text-[10px]"></i>
                            </button>
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Active Filters Summary Banner -->
    {#if isFiltered}
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
            <div class="flex items-center gap-2 flex-wrap text-xs text-content">
                <span class="font-bold text-content/70">Filtres actifs :</span>
                {#each activeTags as tag}
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-background border border-primary/30 text-primary rounded-full font-medium shadow-2xs">
                        <span>{tag}</span>
                        <button
                            type="button"
                            onclick={() => toggleTag(tag)}
                            class="hover:text-red-500 cursor-pointer ml-0.5"
                            aria-label="Retirer ce tag"
                        >
                            <i class="fa-solid fa-xmark text-[10px]"></i>
                        </button>
                    </span>
                {/each}
                {#if isDifficultyFiltered}
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-background border border-primary/30 text-primary rounded-full font-medium shadow-2xs">
                        <span>
                            {#if activeDifficultyMin === activeDifficultyMax}
                                Niveau {activeDifficultyMin}
                            {:else}
                                Niveaux {activeDifficultyMin} à {activeDifficultyMax}
                            {/if}
                        </span>
                        <button
                            type="button"
                            onclick={() => applyFilters({ difficultyMin: 1, difficultyMax: 5 })}
                            class="hover:text-red-500 cursor-pointer ml-0.5"
                            aria-label="Réinitialiser la difficulté"
                        >
                            <i class="fa-solid fa-xmark text-[10px]"></i>
                        </button>
                    </span>
                {/if}
                {#if activeQ}
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-background border border-input-border rounded-full font-medium shadow-2xs">
                        <span>« {activeQ} »</span>
                        <button
                            type="button"
                            onclick={clearSearch}
                            class="hover:text-red-500 cursor-pointer ml-0.5"
                            aria-label="Effacer le mot-clé"
                        >
                            <i class="fa-solid fa-xmark text-[10px]"></i>
                        </button>
                    </span>
                {/if}
                <span class="text-content/60 ml-2 font-medium">
                    ({totalItems} {totalItems > 1 ? "récits trouvés" : "récit trouvé"})
                </span>
            </div>

            <button
                type="button"
                onclick={resetAllFilters}
                class="text-xs text-primary font-semibold hover:underline flex items-center gap-1.5 cursor-pointer shrink-0"
            >
                <i class="fa-solid fa-rotate-left text-[11px]"></i>
                <span>Effacer tous les filtres</span>
            </button>
        </div>
    {/if}

    <!-- Articles Content Display -->
    {#if articles.length === 0}
        <!-- Empty State -->
        <div class="py-16 text-center max-w-lg mx-auto space-y-5 bg-surface rounded-2xl border border-input-border p-8 shadow-xs">
            <div class="w-16 h-16 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl">
                <i class="fa-solid {isFiltered ? 'fa-filter-circle-xmark' : 'fa-book-open'}"></i>
            </div>
            <div class="space-y-1.5">
                <h2 class="text-xl font-serif font-bold text-content">
                    {isFiltered ? "Aucun récit trouvé" : "Aucun article pour le moment"}
                </h2>
                <p class="text-xs text-content/70">
                    {isFiltered
                        ? "Essayez d'ajuster ou d'effacer vos critères de recherche pour afficher plus de récits."
                        : "Soyez le premier à partager une aventure en associant vos itinéraires GPS à un récit illustré."}
                </p>
            </div>
            {#if isFiltered}
                <button
                    type="button"
                    onclick={resetAllFilters}
                    class="btn-secondary text-xs inline-flex items-center gap-2 py-2 px-4 rounded-xl"
                >
                    <i class="fa-solid fa-rotate-left"></i>
                    <span>Effacer les filtres</span>
                </button>
            {:else if $currentUser}
                <a href="/articles/new" class="btn-primary inline-flex items-center gap-2 text-xs py-2 px-4 rounded-xl">
                    <i class="fa-solid fa-plus"></i>
                    <span>Créer le premier article</span>
                </a>
            {:else}
                <a href="/login" class="btn-secondary inline-flex items-center gap-2 text-xs py-2 px-4 rounded-xl">
                    <span>Connectez-vous pour rédiger</span>
                </a>
            {/if}
        </div>
    {:else}
        <!-- Featured Article Hero Card (only when no filters applied) -->
        {#if featuredArticle}
            <ArticleCard article={featuredArticle} variant="featured" />
        {/if}

        <!-- Rest of Articles Grid or Filtered Results Grid -->
        {#if restArticles.length > 0}
            <div class="space-y-6 pt-2">
                {#if isFiltered}
                    <h3 class="text-xl font-serif font-bold text-content">
                        Résultats ({articles.length})
                    </h3>
                {:else if featuredArticle}
                    <h3 class="text-xl font-serif font-bold text-content">Tous les récits</h3>
                {/if}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {#each restArticles as article (article.id)}
                        <ArticleCard {article} variant="grid" />
                    {/each}
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        height: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(150, 150, 150, 0.3);
        border-radius: 9999px;
    }
</style>
