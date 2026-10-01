<script lang="ts">
    import type { Trail } from "$lib/models/trail";
    import type { List } from "$lib/models/list";
    import { formatDistance, formatElevation } from "$lib/util/format_util";
    import { show_toast } from "$lib/stores/toast_store.svelte";
    import { currentUser } from "$lib/stores/user_store";
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        selectedIds?: string[];
        onchange?: (selectedTrails: Trail[]) => void;
    }

    let { selectedIds = $bindable([]), onchange }: Props = $props();

    let allTrails: Trail[] = $state([]);
    let loading: boolean = $state(true);
    let searchQuery: string = $state("");
    let filterMode: "my" | "all" = $state("all");

    // List import modal state
    let showListImportModal: boolean = $state(false);
    let availableLists: List[] = $state([]);
    let loadingLists: boolean = $state(false);
    let listSearchQuery: string = $state("");
    let importingListId: string | null = $state(null);

    onMount(async () => {
        try {
            const res = await fetch("/api/v1/trail?perPage=100&sort=-created");
            if (res.ok) {
                const data = await res.json();
                allTrails = data.items || [];
            }
        } catch (e) {
            console.error("Error fetching trails", e);
        } finally {
            loading = false;
        }
    });

    let selectedTrails = $derived(
        selectedIds
            .map((id) => allTrails.find((t) => t.id === id))
            .filter((t): t is Trail => t !== undefined)
    );

    let filteredTrails = $derived(
        allTrails.filter((t) => {
            const matchesSearch = searchQuery
                ? t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  t.location?.toLowerCase().includes(searchQuery.toLowerCase())
                : true;

            if (!matchesSearch) return false;

            if (filterMode === "my") {
                const myActor = $currentUser?.actor;
                return t.author === myActor;
            }
            return true;
        })
    );

    function toggleTrail(trail: Trail) {
        if (!trail.id) return;
        if (selectedIds.includes(trail.id)) {
            selectedIds = selectedIds.filter((id) => id !== trail.id);
        } else {
            selectedIds = [...selectedIds, trail.id];
        }
        notifyChange();
    }

    function removeTrail(id: string) {
        selectedIds = selectedIds.filter((item) => item !== id);
        notifyChange();
    }

    function notifyChange() {
        const currentSelected = selectedIds
            .map((id) => allTrails.find((t) => t.id === id))
            .filter((t): t is Trail => t !== undefined);
        onchange?.(currentSelected);
    }

    async function openListImportModal() {
        showListImportModal = true;
        if (availableLists.length === 0) {
            loadingLists = true;
            try {
                const res = await fetch("/api/v1/list?perPage=100&sort=-created&expand=author");
                if (res.ok) {
                    const data = await res.json();
                    availableLists = data.items || [];
                }
            } catch (e) {
                console.error("Error fetching lists for import", e);
                show_toast({
                    type: "error",
                    icon: "close",
                    text: "Impossible de charger les listes.",
                });
            } finally {
                loadingLists = false;
            }
        }
    }

    let filteredListsForImport = $derived(
        availableLists.filter((l) =>
            listSearchQuery
                ? l.name.toLowerCase().includes(listSearchQuery.toLowerCase()) ||
                  (l.description && l.description.toLowerCase().includes(listSearchQuery.toLowerCase()))
                : true
        )
    );

    async function importTrailsFromList(targetList: List) {
        if (!targetList.id || importingListId) return;
        importingListId = targetList.id;

        try {
            const res = await fetch(`/api/v1/list/${targetList.id}?expand=trails`);
            if (!res.ok) throw new Error("Erreur lors de la récupération de la liste");

            const data = await res.json();
            const listTrails: Trail[] = data.expand?.trails || [];

            if (listTrails.length === 0) {
                show_toast({
                    type: "info",
                    icon: "circle-info",
                    text: `La liste "${targetList.name}" ne contient aucune trace.`,
                });
                return;
            }

            let newlyAddedCount = 0;
            const updatedIds = [...selectedIds];

            for (const t of listTrails) {
                if (t.id) {
                    // Ensure trail is in allTrails map for display
                    if (!allTrails.some((existing) => existing.id === t.id)) {
                        allTrails = [...allTrails, t];
                    }
                    if (!updatedIds.includes(t.id)) {
                        updatedIds.push(t.id);
                        newlyAddedCount++;
                    }
                }
            }

            selectedIds = updatedIds;
            notifyChange();
            show_toast({
                type: "success",
                icon: "check",
                text: `${newlyAddedCount} trace(s) importée(s) depuis "${targetList.name}" !`,
            });
            showListImportModal = false;
        } catch (e) {
            console.error("Failed to import trails from list:", e);
            show_toast({
                type: "error",
                icon: "close",
                text: "Erreur lors de l'import des traces de la liste.",
            });
        } finally {
            importingListId = null;
        }
    }
</script>

<div class="space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-3">
            <label class="block text-sm font-semibold uppercase tracking-wider text-content/70">
                Itinéraires associés ({selectedIds.length})
            </label>
            {#if selectedTrails.length > 0}
                {@const totalDist = selectedTrails.reduce((sum, t) => sum + (t.distance || 0), 0)}
                {@const totalElev = selectedTrails.reduce((sum, t) => sum + (t.elevation_gain || 0), 0)}
                <span class="text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
                    Total calculé : {formatDistance(totalDist)} · {formatElevation(totalElev)}
                </span>
            {/if}
        </div>

        <!-- 1-Click Import from a list button -->
        <button
            type="button"
            onclick={openListImportModal}
            class="text-xs font-semibold px-3 py-1.5 rounded-xl border border-primary/30 text-primary bg-primary/5 hover:bg-primary/15 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
            title="Importer d'un clic toutes les traces d'une liste existante"
        >
            <i class="fa-solid fa-file-import text-xs"></i>
            <span>Importer depuis une liste</span>
        </button>
    </div>

    <!-- Selected Trails Badges -->
    {#if selectedTrails.length > 0}
        <div class="flex flex-wrap gap-2 p-3 bg-input-background/50 border border-input-border rounded-xl">
            {#each selectedTrails as trail, idx (trail.id)}
                <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/15 text-primary rounded-lg text-sm font-medium border border-primary/20 shadow-xs">
                    <span class="w-5 h-5 flex items-center justify-center bg-primary text-white text-xs rounded-full font-bold">
                        {idx + 1}
                    </span>
                    <span class="max-w-[200px] truncate">{trail.name}</span>
                    <span class="text-xs opacity-75 font-normal">
                        ({formatDistance(trail.distance)} · {formatElevation(trail.elevation_gain)})
                    </span>
                    <button
                        type="button"
                        onclick={() => removeTrail(trail.id!)}
                        class="hover:text-red-500 transition-colors ml-1 cursor-pointer"
                        aria-label="Retirer l'itinéraire"
                    >
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    <!-- Search input & filter toggle -->
    <div class="flex items-center gap-2">
        <div class="relative flex-1">
            <i class="fa-solid fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-content/50 text-sm"></i>
            <input
                type="text"
                bind:value={searchQuery}
                placeholder="Rechercher une trace à associer (ex: désert, étape...)"
                class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input-border bg-background text-content placeholder:text-content/40 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
        </div>
        {#if $currentUser}
            <div class="flex items-center text-xs bg-input-background/60 p-0.5 rounded-xl border border-input-border shrink-0">
                <button
                    type="button"
                    onclick={() => (filterMode = "all")}
                    class="px-3 py-2 rounded-lg transition-all font-medium {filterMode === 'all' ? 'bg-background text-primary shadow-xs' : 'text-content/60 hover:text-content'}"
                >
                    Toutes
                </button>
                <button
                    type="button"
                    onclick={() => (filterMode = "my")}
                    class="px-3 py-2 rounded-lg transition-all font-medium {filterMode === 'my' ? 'bg-background text-primary shadow-xs' : 'text-content/60 hover:text-content'}"
                >
                    Mes traces
                </button>
            </div>
        {/if}
    </div>

    <!-- Available trails list -->
    {#if loading}
        <div class="py-4 text-center text-sm text-content/60">
            <i class="fa-solid fa-spinner fa-spin mr-2"></i> Chargement des traces...
        </div>
    {:else if filteredTrails.length === 0}
        <div class="py-4 text-center text-sm text-content/60 bg-input-background/40 border border-input-border border-dashed rounded-xl">
            Aucun itinéraire trouvé.
        </div>
    {:else}
        <div class="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {#each filteredTrails as trail (trail.id)}
                {@const isSelected = selectedIds.includes(trail.id || "")}
                <button
                    type="button"
                    onclick={() => toggleTrail(trail)}
                    class="w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-150 {isSelected ? 'border-primary bg-primary/5 shadow-xs' : 'border-input-border/70 hover:border-primary/50 hover:bg-input-background/60'}"
                >
                    <div class="min-w-0 flex items-center gap-3">
                        <div class="w-5 h-5 rounded border flex items-center justify-center {isSelected ? 'bg-primary border-primary text-white' : 'border-input-border'}">
                            {#if isSelected}
                                <i class="fa-solid fa-check text-xs"></i>
                            {/if}
                        </div>
                        <div class="truncate">
                            <p class="text-sm font-semibold text-content truncate">{trail.name}</p>
                            {#if trail.location}
                                <p class="text-xs text-content/70 truncate">{trail.location}</p>
                            {/if}
                        </div>
                    </div>
                    <div class="text-right shrink-0 ml-4">
                        <span class="text-xs font-semibold text-content">{formatDistance(trail.distance)}</span>
                        <span class="text-xs text-content/70 block">{formatElevation(trail.elevation_gain)}</span>
                    </div>
                </button>
            {/each}
        </div>
    {/if}
</div>

<!-- Modal 1-Click Import from a list -->
{#if showListImportModal}
    <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-background border border-input-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div class="flex items-center justify-between border-b border-input-border pb-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <i class="fa-solid fa-file-import text-sm"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-content">Importer les traces d'une liste</h3>
                        <p class="text-xs text-content/60">Ajoute toutes les étapes de la liste sélectionnée à votre récit.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onclick={() => (showListImportModal = false)}
                    class="text-content/50 hover:text-content text-sm cursor-pointer p-1"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- List search -->
            <div class="relative">
                <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-content/50 text-xs"></i>
                <input
                    type="text"
                    bind:value={listSearchQuery}
                    placeholder="Filtrer les listes..."
                    class="w-full pl-8 pr-3 py-2 rounded-xl border border-input-border bg-background text-content placeholder:text-content/40 text-xs focus:ring-2 focus:ring-primary focus:outline-hidden"
                />
            </div>

            <!-- Lists items -->
            <div class="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {#if loadingLists}
                    <div class="py-6 text-center text-xs text-content/60">
                        <i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Chargement des listes...
                    </div>
                {:else if filteredListsForImport.length === 0}
                    <div class="py-6 text-center text-xs text-content/60 bg-input-background/40 border border-dashed border-input-border rounded-xl">
                        Aucune liste disponible.
                    </div>
                {:else}
                    {#each filteredListsForImport as list (list.id)}
                        {@const trailCount = list.trails?.length || 0}
                        {@const isImporting = importingListId === list.id}
                        {@const authorName = list.expand?.author?.preferred_username || list.expand?.author?.username || "Auteur"}
                        <div class="flex items-center justify-between p-3 rounded-xl border border-input-border hover:border-primary/40 bg-input-background/30 hover:bg-input-background/60 transition-all">
                            <div class="min-w-0 pr-3">
                                <p class="text-sm font-semibold text-content truncate">{list.name}</p>
                                <p class="text-xs text-content/60">
                                    Par {authorName} · {trailCount} {trailCount > 1 ? "traces" : "trace"}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={isImporting}
                                onclick={() => importTrailsFromList(list)}
                                class="btn-primary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 shrink-0 shadow-2xs"
                            >
                                {#if isImporting}
                                    <i class="fa-solid fa-spinner fa-spin text-xs"></i>
                                    <span>Import...</span>
                                {:else}
                                    <i class="fa-solid fa-plus text-xs"></i>
                                    <span>Importer ({trailCount})</span>
                                {/if}
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>

            <div class="flex justify-end pt-2">
                <button
                    type="button"
                    onclick={() => (showListImportModal = false)}
                    class="btn-secondary text-xs py-2 px-4 rounded-xl"
                >
                    Fermer
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(150, 150, 150, 0.3);
        border-radius: 9999px;
    }
</style>
