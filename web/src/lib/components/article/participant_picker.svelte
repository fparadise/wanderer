<script lang="ts">
    import type { Actor, ActorSearchResult } from "$lib/models/activitypub/actor";
    import ActorSearch from "$lib/components/actor_search.svelte";
    import type { SearchItem } from "$lib/components/base/search.svelte";
    import { getFileURL } from "$lib/util/file_util";

    interface Props {
        selectedIds?: string[];
        initialActors?: Actor[];
        onchange?: (selectedIds: string[], actors: Actor[]) => void;
    }

    let {
        selectedIds = $bindable([]),
        initialActors = [],
        onchange,
    }: Props = $props();

    let actorsMap = $state<Map<string, Partial<Actor>>>(new Map());

    // Populate initial actors
    $effect(() => {
        initialActors.forEach((actor) => {
            if (actor.id && !actorsMap.has(actor.id)) {
                actorsMap.set(actor.id, actor);
            }
        });
    });

    let selectedActors = $derived(
        selectedIds.map((id) => {
            const actor = actorsMap.get(id);
            return (
                actor || {
                    id,
                    username: "Participant",
                    preferred_username: "Participant",
                    is_local: true,
                }
            );
        })
    );

    function handleSelectActor(item: SearchItem) {
        const actorResult: ActorSearchResult = item.value;
        if (!actorResult || !actorResult.id) return;

        if (!selectedIds.includes(actorResult.id)) {
            actorsMap.set(actorResult.id, {
                id: actorResult.id,
                username: actorResult.username,
                preferred_username: actorResult.preferred_username,
                domain: actorResult.domain,
                is_local: actorResult.is_local,
                iri: actorResult.iri,
                icon: actorResult.icon,
            });
            selectedIds = [...selectedIds, actorResult.id];
            notifyChange();
        }
    }

    function removeParticipant(id: string) {
        selectedIds = selectedIds.filter((item) => item !== id);
        notifyChange();
    }

    function notifyChange() {
        const fullActors = selectedIds
            .map((id) => actorsMap.get(id))
            .filter((a): a is Actor => a !== undefined);
        onchange?.(selectedIds, fullActors);
    }
</script>

<div class="space-y-3">
    <div class="flex items-center justify-between">
        <label class="block text-xs uppercase font-bold tracking-wider text-content/70">
            Co-auteurs & Participants ({selectedIds.length})
        </label>
    </div>

    <!-- Selected participants badges -->
    {#if selectedActors.length > 0}
        <div class="flex flex-wrap gap-2 p-3 bg-input-background/40 border border-input-border rounded-xl">
            {#each selectedActors as actor (actor.id)}
                {@const username = actor.preferred_username || actor.username}
                {@const avatarUrl = actor.icon
                    ? (actor.icon.startsWith("http") ? actor.icon : getFileURL(actor as any, actor.icon))
                    : `https://api.dicebear.com/7.x/initials/svg?seed=${username}&backgroundType=gradientLinear`}
                <div class="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 bg-background text-content rounded-full text-xs font-medium border border-input-border shadow-2xs group">
                    <img
                        src={avatarUrl}
                        alt={username}
                        class="w-5 h-5 rounded-full object-cover shrink-0"
                    />
                    <span class="max-w-[140px] truncate font-semibold">
                        @{username}
                    </span>
                    {#if !actor.is_local && actor.domain}
                        <span class="text-[10px] text-content/50 max-w-[90px] truncate">
                            @{actor.domain}
                        </span>
                    {/if}
                    <button
                        type="button"
                        onclick={() => removeParticipant(actor.id!)}
                        class="text-content/40 hover:text-red-500 transition-colors ml-0.5 cursor-pointer"
                        aria-label="Retirer ce participant"
                    >
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    <!-- Search actor -->
    <div class="relative">
        <ActorSearch
            onclick={handleSelectActor}
            label=""
            clearAfterSelect={true}
        />
    </div>
    <p class="text-[11px] text-content/60 leading-normal">
        <i class="fa-solid fa-users text-primary mr-1"></i>
        Recherchez un utilisateur local ou fédéré. Les membres de votre instance pourront également co-éditer ce récit.
    </p>
</div>
