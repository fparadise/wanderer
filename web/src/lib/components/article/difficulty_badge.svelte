<script lang="ts">
    import { TECHNICAL_DIFFICULTY_LEVELS, type TechnicalDifficultyLevel } from "$lib/models/editorial_tags";

    interface Props {
        level?: number | string | null;
        size?: "compact" | "normal" | "pill";
        showTooltip?: boolean;
        class?: string;
    }

    let {
        level = null,
        size = "normal",
        showTooltip = true,
        class: extraClass = "",
    }: Props = $props();

    let numLevel = $derived(Number(level) || null);
    let diffInfo = $derived<TechnicalDifficultyLevel | null>(
        numLevel && TECHNICAL_DIFFICULTY_LEVELS[numLevel]
            ? TECHNICAL_DIFFICULTY_LEVELS[numLevel]
            : null
    );
</script>

{#if diffInfo}
    {#if size === "compact"}
        <!-- Ultra-compact badge for card overlays (e.g. "Niv. 3") -->
        <span
            class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border backdrop-blur-xs shadow-2xs {diffInfo.color} {diffInfo.bgColor} {diffInfo.borderColor} {extraClass}"
            title={showTooltip ? `${diffInfo.title} : ${diffInfo.subtitle}` : undefined}
        >
            Niv. {diffInfo.level}
        </span>
    {:else if size === "pill"}
        <!-- Pill badge for article headers & stat bars -->
        <span
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border {diffInfo.color} {diffInfo.bgColor} {diffInfo.borderColor} {extraClass}"
            title={showTooltip ? diffInfo.subtitle : undefined}
        >
            <span class="w-1.5 h-1.5 rounded-full bg-current shrink-0"></span>
            <span>{diffInfo.title}</span>
        </span>
    {:else}
        <!-- Normal detailed card or block -->
        <div
            class="flex items-start gap-3 p-3.5 rounded-xl border {diffInfo.bgColor} {diffInfo.borderColor} {extraClass}"
        >
            <div
                class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 {diffInfo.color} bg-background/80 border {diffInfo.borderColor}"
            >
                {diffInfo.level}
            </div>
            <div class="min-w-0 flex-1">
                <p class="text-xs font-bold {diffInfo.color} uppercase tracking-wider">
                    {diffInfo.title}
                </p>
                <p class="text-xs text-content/80 mt-0.5 leading-relaxed">
                    {diffInfo.subtitle}
                </p>
            </div>
        </div>
    {/if}
{/if}
