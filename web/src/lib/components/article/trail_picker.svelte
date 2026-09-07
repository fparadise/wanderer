<script lang="ts">
    import type { Trail } from "$lib/models/trail";
    import { formatDistance, formatElevation } from "$lib/util/format_util";
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
        allTrails.filter((t) =>
            searchQuery
                ? t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  t.location?.toLowerCase().includes(searchQuery.toLowerCase())
                : true
        )
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
</script>

<div class="space-y-4">
    <div class="flex items-center justify-between">
        <label class="block text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Itinéraires associés ({selectedIds.length})
        </label>
        {#if selectedTrails.length > 0}
            <span class="text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
                Total calculé : {Math.round(selectedTrails.reduce((sum, t) => sum + (t.distance || 0), 0) / 1000)} km · +{Math.round(selectedTrails.reduce((sum, t) => sum + (t.elevation_gain || 0), 0))} m
            </span>
        {/if}
    </div>

    <!-- Selected Trails Badges -->
    {#if selectedTrails.length > 0}
        <div class="flex flex-wrap gap-2 p-3 bg-card border rounded-xl">
            {#each selectedTrails as trail, idx (trail.id)}
                <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/15 text-primary rounded-lg text-sm font-medium border border-primary/20 shadow-xs">
                    <span class="w-5 h-5 flex items-center justify-center bg-primary text-white text-xs rounded-full font-bold">
                        {idx + 1}
                    </span>
                    <span class="max-w-[200px] truncate">{trail.name}</span>
                    <span class="text-xs opacity-75 font-normal">
                        ({Math.round((trail.distance || 0) / 1000)} km · +{Math.round(trail.elevation_gain || 0)} m)
                    </span>
                    <button
                        type="button"
                        onclick={() => removeTrail(trail.id!)}
                        class="hover:text-red-500 transition-colors ml-1"
                        aria-label="Retirer l'itinéraire"
                    >
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    <!-- Search input -->
    <div class="relative">
        <i class="fa-solid fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"></i>
        <input
            type="text"
            bind:value={searchQuery}
            placeholder="Rechercher une trace à associer (ex: désert, étape...)"
            class="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
    </div>

    <!-- Available trails list -->
    {#if loading}
        <div class="py-4 text-center text-sm text-muted-foreground">
            <i class="fa-solid fa-spinner fa-spin mr-2"></i> Chargement de vos traces...
        </div>
    {:else if filteredTrails.length === 0}
        <div class="py-4 text-center text-sm text-muted-foreground bg-card/50 border border-dashed rounded-xl">
            Aucun itinéraire trouvé.
        </div>
    {:else}
        <div class="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {#each filteredTrails as trail (trail.id)}
                {@const isSelected = selectedIds.includes(trail.id || "")}
                <button
                    type="button"
                    onclick={() => toggleTrail(trail)}
                    class="w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-150 {isSelected ? 'border-primary bg-primary/5 shadow-xs' : 'border-border/60 hover:border-primary/50 hover:bg-card/75'}"
                >
                    <div class="min-w-0 flex items-center gap-3">
                        <div class="w-5 h-5 rounded border flex items-center justify-center {isSelected ? 'bg-primary border-primary text-white' : 'border-border'}">
                            {#if isSelected}
                                <i class="fa-solid fa-check text-xs"></i>
                            {/if}
                        </div>
                        <div class="truncate">
                            <p class="text-sm font-semibold text-foreground truncate">{trail.name}</p>
                            {#if trail.location}
                                <p class="text-xs text-muted-foreground truncate">{trail.location}</p>
                            {/if}
                        </div>
                    </div>
                    <div class="text-right shrink-0 ml-4">
                        <span class="text-xs font-semibold text-foreground">{Math.round((trail.distance || 0) / 1000)} km</span>
                        <span class="text-xs text-muted-foreground block">+{Math.round(trail.elevation_gain || 0)} m</span>
                    </div>
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(150, 150, 150, 0.3);
        border-radius: 9999px;
    }
</style>
