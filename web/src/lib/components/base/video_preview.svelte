<script lang="ts">
    import type { MouseEventHandler } from "svelte/elements";

    interface Props {
        src: string;
        id?: string | undefined;
        extraClasses?: string;
        videoClasses?: string;
        style?: string | undefined;
        showBadge?: boolean;
        badgePosition?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
        badgeSize?: "sm" | "md";
        hoverPlay?: boolean;
        resetOnLeave?: boolean;
        loop?: boolean;
        muted?: boolean;
        playsinline?: boolean;
        controls?: boolean;
        preload?: "none" | "metadata" | "auto";
        onclick?: MouseEventHandler<HTMLDivElement> | undefined;
    }

    let {
        src,
        id = undefined,
        extraClasses = "w-full h-full",
        videoClasses = "",
        style = undefined,
        showBadge = true,
        badgePosition = "top-right",
        badgeSize = "md",
        hoverPlay = true,
        resetOnLeave = false,
        loop = true,
        muted = true,
        playsinline = true,
        controls = false,
        preload = "none",
        onclick = undefined,
    }: Props = $props();

    let videoEl: HTMLVideoElement | undefined = $state();
    let isHovered = $state(false);

    function handleMouseEnter(e: MouseEvent) {
        isHovered = true;
        if (hoverPlay && videoEl) {
            videoEl.play().catch(() => {});
        }
    }

    function handleMouseLeave(e: MouseEvent) {
        isHovered = false;
        if (hoverPlay && videoEl) {
            videoEl.pause();
            if (resetOnLeave) {
                videoEl.currentTime = 0;
            }
        }
    }

    let badgePositionClass = $derived.by(() => {
        switch (badgePosition) {
            case "top-left":
                return "top-2 left-2";
            case "bottom-left":
                return "bottom-2 left-2";
            case "bottom-right":
                return "bottom-2 right-2";
            case "top-right":
            default:
                return "top-2 right-2";
        }
    });

    let badgeSizeClass = $derived(
        badgeSize === "sm" ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-xs",
    );
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
    class="relative {extraClasses}"
    {style}
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
    {onclick}
    role={onclick ? "button" : undefined}
    tabindex={onclick ? 0 : undefined}
>
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
        bind:this={videoEl}
        {id}
        {src}
        {preload}
        {muted}
        {playsinline}
        {loop}
        {controls}
        class="w-full h-full object-cover bg-neutral-900 {videoClasses}"
    ></video>
    {#if showBadge}
        <div
            class="absolute {badgePositionClass} bg-black/60 backdrop-blur-sm text-white rounded-full flex items-center justify-center pointer-events-none transition-opacity duration-200 z-10 {isHovered
                ? 'opacity-0'
                : 'opacity-100'} {badgeSizeClass}"
        >
            <i class="fa fa-video"></i>
        </div>
    {/if}
</div>
