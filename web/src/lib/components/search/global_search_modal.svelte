<script lang="ts">
    import { goto } from "$app/navigation";
    import type { TrailSearchResult } from "$lib/models/trail";
    import { articles_index } from "$lib/stores/article_store";
    import {
        searchMulti,
        type ListSearchResult,
        type LocationSearchResult,
    } from "$lib/stores/search_store";
    import { getIconForLocation } from "$lib/util/icon_util";
    import { tick } from "svelte";

    type SearchResultItem = {
        title: string;
        description?: string;
        category: "trail" | "article" | "list" | "location";
        categoryLabel: string;
        icon: string;
        url: string;
    };

    let isOpen = $state(false);
    let query = $state("");
    let results: SearchResultItem[] = $state([]);
    let isSearching = $state(false);
    let selectedIndex = $state(0);
    let inputElement: HTMLInputElement | undefined = $state();

    let debounceTimer: any;

    export async function openModal() {
        isOpen = true;
        query = "";
        results = [];
        selectedIndex = 0;
        await tick();
        inputElement?.focus();
    }

    export function closeModal() {
        isOpen = false;
        query = "";
        results = [];
        selectedIndex = 0;
    }

    function handleKeydown(e: KeyboardEvent) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            if (isOpen) {
                closeModal();
            } else {
                openModal();
            }
            return;
        }

        if (!isOpen) return;

        if (e.key === "Escape") {
            e.preventDefault();
            closeModal();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (results.length > 0) {
                selectedIndex = (selectedIndex + 1) % results.length;
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (results.length > 0) {
                selectedIndex =
                    (selectedIndex - 1 + results.length) % results.length;
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[selectedIndex]) {
                selectItem(results[selectedIndex]);
            }
        }
    }

    function onInputChange() {
        clearTimeout(debounceTimer);
        if (!query.trim()) {
            results = [];
            isSearching = false;
            return;
        }
        isSearching = true;
        debounceTimer = setTimeout(() => {
            performSearch(query.trim());
        }, 200);
    }

    async function performSearch(q: string) {
        try {
            const [multiRes, articlesRes] = await Promise.all([
                searchMulti({
                    queries: [
                        { indexUid: "trails", q, limit: 4 },
                        { indexUid: "lists", q, limit: 3 },
                        { indexUid: "locations", q, limit: 3 },
                    ],
                }).catch(() => null),
                articles_index(1, 20).catch(() => null),
            ]);

            const newResults: SearchResultItem[] = [];

            // 1. Articles / Récits
            if (articlesRes?.items) {
                const lowerQ = q.toLowerCase();
                const matched = (articlesRes.items as any[])
                    .filter(
                        (a: any) =>
                            a.title?.toLowerCase().includes(lowerQ) ||
                            a.subtitle?.toLowerCase().includes(lowerQ) ||
                            (a.tags && a.tags.some((t: string) => t.toLowerCase().includes(lowerQ)))
                    )
                    .slice(0, 3);

                for (const a of matched) {
                    newResults.push({
                        title: a.title,
                        description: a.subtitle || "Récit d'aventure",
                        category: "article",
                        categoryLabel: "Magazine & Récits",
                        icon: "feather",
                        url: `/articles/${a.id}`,
                    });
                }
            }

            // 2. Trails / Itinéraires
            if (multiRes && multiRes[0]?.hits) {
                for (const t of multiRes[0].hits as TrailSearchResult[]) {
                    newResults.push({
                        title: t.name,
                        description: `Itinéraire${t.location?.length ? " · " + t.location : ""}`,
                        category: "trail",
                        categoryLabel: "Itinéraires",
                        icon: "route",
                        url: `/trail/view/@${t.author_name}${t.domain ? `@${t.domain}` : ""}/${t.id}`,
                    });
                }
            }

            // 3. Lists / Listes
            if (multiRes && multiRes[1]?.hits) {
                for (const l of multiRes[1].hits as ListSearchResult[]) {
                    newResults.push({
                        title: l.name,
                        description: `Liste de ${l.trails} itinéraire(s)`,
                        category: "list",
                        categoryLabel: "Listes",
                        icon: "layer-group",
                        url: `/lists/@${l.author_name}${l.domain ? `@${l.domain}` : ""}/${l.id}`,
                    });
                }
            }

            // 4. Locations / Lieux
            if (multiRes && multiRes[2]?.hits) {
                for (const loc of multiRes[2].hits as LocationSearchResult[]) {
                    newResults.push({
                        title: loc.name,
                        description: loc.description || "Lieu géographique",
                        category: "location",
                        categoryLabel: "Lieux",
                        icon: getIconForLocation(loc),
                        url: `/map/?lat=${loc.lat}&lon=${loc.lon}`,
                    });
                }
            }

            results = newResults;
            selectedIndex = 0;
        } catch (err) {
            console.error("Search error:", err);
        } finally {
            isSearching = false;
        }
    }

    function selectItem(item: SearchResultItem) {
        closeModal();
        goto(item.url);
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
    <!-- Modal Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-xs z-[1100] flex items-start justify-center pt-16 sm:pt-24 px-4"
        onclick={(e) => {
            if (e.target === e.currentTarget) closeModal();
        }}
    >
        <!-- Modal Dialog -->
        <div
            class="bg-menu-background border border-input-border shadow-2xl rounded-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
        >
            <!-- Search Header -->
            <div class="relative flex items-center border-b border-input-border px-4 py-3">
                <i class="fa fa-search text-muted-foreground mr-3 text-lg"></i>
                <input
                    bind:this={inputElement}
                    bind:value={query}
                    oninput={onInputChange}
                    type="text"
                    placeholder="Rechercher des traces, récits, listes, lieux..."
                    class="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-base focus:ring-0"
                />
                {#if query.length > 0}
                    <button
                        type="button"
                        aria-label="Effacer"
                        onclick={() => {
                            query = "";
                            results = [];
                            inputElement?.focus();
                        }}
                        class="text-muted-foreground hover:text-foreground text-sm p-1 mr-2"
                    >
                        <i class="fa fa-xmark"></i>
                    </button>
                {/if}
                <kbd
                    class="hidden sm:inline-block px-2 py-0.5 text-xs text-muted-foreground bg-input-border/40 rounded border border-input-border"
                >
                    ESC
                </kbd>
            </div>

            <!-- Search Results or Status -->
            <div class="overflow-y-auto flex-1 divide-y divide-input-border/50">
                {#if isSearching && results.length === 0}
                    <div class="p-8 text-center text-muted-foreground flex items-center justify-center gap-3">
                        <i class="fa fa-circle-notch fa-spin text-primary"></i>
                        <span>Recherche en cours...</span>
                    </div>
                {:else if query.trim().length > 0 && results.length === 0 && !isSearching}
                    <div class="p-8 text-center text-muted-foreground">
                        <i class="fa fa-magnifying-glass text-2xl mb-2 opacity-50 block"></i>
                        <span>Aucun résultat pour « {query} »</span>
                    </div>
                {:else if results.length > 0}
                    <ul class="py-2">
                        {#each results as item, idx}
                            <li>
                                <button
                                    type="button"
                                    onclick={() => selectItem(item)}
                                    onmouseenter={() => (selectedIndex = idx)}
                                    class="w-full text-left flex items-center gap-3.5 px-4 py-3 cursor-pointer transition-colors {idx === selectedIndex ? 'bg-menu-item-background-focus text-foreground' : 'hover:bg-menu-item-background-hover'}"
                                >
                                    <div
                                        class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 {item.category === 'article' ? 'bg-amber-500/10 text-amber-500' : item.category === 'trail' ? 'bg-primary/10 text-primary' : item.category === 'list' ? 'bg-blue-500/10 text-blue-500' : 'bg-neutral-500/10 text-neutral-400'}"
                                    >
                                        <i class="fa fa-{item.icon} text-sm"></i>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                            <span class="font-medium text-sm truncate">{item.title}</span>
                                            <span class="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground px-1.5 py-0.5 rounded bg-input-border/30">
                                                {item.categoryLabel}
                                            </span>
                                        </div>
                                        {#if item.description}
                                            <p class="text-xs text-muted-foreground truncate mt-0.5">
                                                {item.description}
                                            </p>
                                        {/if}
                                    </div>
                                    {#if idx === selectedIndex}
                                        <i class="fa fa-arrow-right text-muted-foreground text-xs shrink-0"></i>
                                    {/if}
                                </button>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <div class="p-6 text-center text-xs text-muted-foreground">
                        Saisissez un mot-clé pour rechercher des traces GPS, des récits de voyage, des listes ou des lieux.
                    </div>
                {/if}
            </div>

            <!-- Modal Footer -->
            <div class="hidden sm:flex items-center justify-between px-4 py-2 bg-input-border/20 border-t border-input-border text-[11px] text-muted-foreground">
                <div class="flex items-center gap-3">
                    <span><kbd class="px-1.5 py-0.5 rounded bg-input-border/50 border border-input-border">↑</kbd> <kbd class="px-1.5 py-0.5 rounded bg-input-border/50 border border-input-border">↓</kbd> Naviguer</span>
                    <span><kbd class="px-1.5 py-0.5 rounded bg-input-border/50 border border-input-border">↵</kbd> Ouvrir</span>
                </div>
                <div>
                    <span><kbd class="px-1.5 py-0.5 rounded bg-input-border/50 border border-input-border">ESC</kbd> Fermer</span>
                </div>
            </div>
        </div>
    </div>
{/if}
