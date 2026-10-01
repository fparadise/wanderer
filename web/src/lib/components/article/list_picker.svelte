<script lang="ts">
    import type { List } from "$lib/models/list";
    import { currentUser } from "$lib/stores/user_store";
    import { getFileURL } from "$lib/util/file_util";
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        selectedIds?: string[];
        initialLists?: List[];
        onchange?: (selectedIds: string[], selectedLists: List[]) => void;
    }

    let {
        selectedIds = $bindable([]),
        initialLists = [],
        onchange,
    }: Props = $props();

    let allLists: List[] = $state([]);
    let loading: boolean = $state(true);
    let searchQuery: string = $state("");
    let filterMode: "my" | "all" = $state("all");

    // Cache to keep track of selected lists objects
    let listsMap = $state<Map<string, List>>(new Map());

    $effect(() => {
        initialLists.forEach((l) => {
            if (l.id && !listsMap.has(l.id)) {
                listsMap.set(l.id, l);
            }
        });
    });

    onMount(async () => {
        try {
            const res = await fetch("/api/v1/list?perPage=100&sort=-created&expand=author");
            if (res.ok) {
                const data = await res.json();
                allLists = data.items || [];
                allLists.forEach((l) => {
                    if (l.id) listsMap.set(l.id, l);
                });
            }
        } catch (e) {
            console.error("Error fetching lists", e);
        } finally {
            loading = false;
        }
    });

    let selectedLists = $derived(
        selectedIds
            .map((id) => listsMap.get(id))
            .filter((l): l is List => l !== undefined)
    );

    let filteredLists = $derived(
        allLists.filter((l) => {
            const matchesSearch = searchQuery
                ? l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()))
                : true;

            if (!matchesSearch) return false;

            if (filterMode === "my") {
                const myActor = $currentUser?.actor;
                return l.author === myActor;
            }
            return true;
        })
    );

    function toggleList(list: List) {
        if (!list.id) return;
        if (selectedIds.includes(list.id)) {
            selectedIds = selectedIds.filter((id) => id !== list.id);
        } else {
            selectedIds = [...selectedIds, list.id];
            listsMap.set(list.id, list);
        }
        notifyChange();
    }

    function removeList(id: string) {
        selectedIds = selectedIds.filter((item) => item !== id);
        notifyChange();
    }

    function notifyChange() {
        const fullLists = selectedIds
            .map((id) => listsMap.get(id))
            .filter((l): l is List => l !== undefined);
        onchange?.(selectedIds, fullLists);
    }
</script>

<div class="space-y-3">
    <div class="flex items-center justify-between">
        <label class="block text-xs uppercase font-bold tracking-wider text-content/70">
            Listes associées en ressource ({selectedIds.length})
        </label>
        {#if $currentUser}
            <div class="flex items-center text-xs bg-input-background/60 p-0.5 rounded-lg border border-input-border">
                <button
                    type="button"
                    onclick={() => (filterMode = "all")}
                    class="px-2.5 py-1 rounded-md transition-all font-medium {filterMode === 'all' ? 'bg-background text-primary shadow-xs' : 'text-content/60 hover:text-content'}"
                >
                    Toutes
                </button>
                <button
                    type="button"
                    onclick={() => (filterMode = "my")}
                    class="px-2.5 py-1 rounded-md transition-all font-medium {filterMode === 'my' ? 'bg-background text-primary shadow-xs' : 'text-content/60 hover:text-content'}"
                >
                    Mes listes
                </button>
            </div>
        {/if}
    </div>

    <!-- Selected lists badges -->
    {#if selectedLists.length > 0}
        <div class="flex flex-wrap gap-2 p-3 bg-input-background/40 border border-input-border rounded-xl">
            {#each selectedLists as list (list.id)}
                {@const trailCount = list.trails?.length || 0}
                <div class="inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 bg-background text-content rounded-xl text-xs font-medium border border-input-border shadow-2xs group">
                    <i class="fa-solid fa-layer-group text-primary text-xs"></i>
                    <span class="max-w-[220px] truncate font-semibold">
                        {list.name}
                    </span>
                    <span class="text-[10px] text-content/60 bg-input-background px-1.5 py-0.5 rounded-md">
                        {trailCount} {trailCount > 1 ? "traces" : "trace"}
                    </span>
                    <button
                        type="button"
                        onclick={() => removeList(list.id!)}
                        class="text-content/40 hover:text-red-500 transition-colors ml-1 cursor-pointer"
                        aria-label="Retirer cette liste"
                    >
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    <!-- Search input -->
    <div class="relative">
        <i class="fa-solid fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-content/50 text-sm"></i>
        <input
            type="text"
            bind:value={searchQuery}
            placeholder="Rechercher une liste thématique à associer..."
            class="w-full pl-10 pr-4 py-2 rounded-xl border border-input-border bg-background text-content placeholder:text-content/40 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
    </div>

    <!-- Available lists -->
    {#if loading}
        <div class="py-4 text-center text-sm text-content/60">
            <i class="fa-solid fa-spinner fa-spin mr-2"></i> Chargement des listes...
        </div>
    {:else if filteredLists.length === 0}
        <div class="py-4 text-center text-xs text-content/60 bg-input-background/40 border border-input-border border-dashed rounded-xl">
            Aucune liste trouvée.
        </div>
    {:else}
        <div class="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {#each filteredLists as list (list.id)}
                {@const isSelected = selectedIds.includes(list.id || "")}
                {@const trailCount = list.trails?.length || 0}
                {@const authorName = list.expand?.author?.preferred_username || list.expand?.author?.username || "Auteur"}
                <button
                    type="button"
                    onclick={() => toggleList(list)}
                    class="w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all duration-150 {isSelected ? 'border-primary bg-primary/5 shadow-xs' : 'border-input-border/70 hover:border-primary/50 hover:bg-input-background/60'}"
                >
                    <div class="min-w-0 flex items-center gap-3">
                        <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 {isSelected ? 'bg-primary border-primary text-white' : 'border-input-border'}">
                            {#if isSelected}
                                <i class="fa-solid fa-check text-[10px]"></i>
                            {/if}
                        </div>
                        <div class="truncate">
                            <p class="text-xs font-semibold text-content truncate">{list.name}</p>
                            <p class="text-[11px] text-content/60 truncate">
                                Par {authorName} · {trailCount} {trailCount > 1 ? "traces" : "trace"}
                            </p>
                        </div>
                    </div>
                    {#if list.public}
                        <span class="text-[10px] text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full shrink-0 ml-2">
                            Public
                        </span>
                    {/if}
                </button>
            {/each}
        </div>
    {/if}

    <p class="text-[11px] text-content/60 leading-normal">
        <i class="fa-solid fa-circle-info text-primary mr-1"></i>
        Ces listes seront présentées comme ressources complémentaires aux lecteurs, sans charger leurs traces sur la carte de votre récit.
    </p>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 5px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(150, 150, 150, 0.3);
        border-radius: 9999px;
    }
</style>
