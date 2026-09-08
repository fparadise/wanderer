<script lang="ts">
    interface Props {
        height?: number;
        showBadge?: boolean;
        showSubtitle?: boolean;
        showIcon?: boolean;
        invert?: boolean;
        class?: string;
    }

    let {
        height = 36,
        showBadge = true,
        showSubtitle = true,
        showIcon = true,
        invert = false,
        class: customClass = ""
    }: Props = $props();
</script>

<div class="inline-flex items-center gap-2.5 select-none {customClass}">
    {#if showIcon}
        <svg
            width={height}
            height={height}
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="shrink-0 transition-transform duration-300 group-hover:scale-105"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="tc-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#3B82F6" />
                    <stop offset="100%" stop-color="#1D4ED8" />
                </linearGradient>
                <linearGradient id="tc-glow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#60A5FA" stop-opacity="0.8" />
                    <stop offset="100%" stop-color="#2563EB" stop-opacity="0.2" />
                </linearGradient>
            </defs>

            <!-- Background squircle -->
            <rect width="40" height="40" rx="10" fill="url(#tc-gradient)" />

            <!-- Contour area fill -->
            <path
                d="M8 29 L16 19 L23 24 L29 15 L32 29 Z"
                fill="url(#tc-glow)"
            />

            <!-- Topographic contour base line -->
            <path
                d="M8 31 Q 14 26 21 28 T 32 27"
                stroke="white"
                stroke-opacity="0.35"
                stroke-width="1.8"
                stroke-linecap="round"
            />

            <!-- Main GPS Trail / Ridge Line -->
            <path
                d="M8 29 L16 19 L23 24 L29 15"
                stroke="white"
                stroke-width="2.6"
                stroke-linecap="round"
                stroke-linejoin="round"
            />

            <!-- Beacon / Waypoint dot at peak -->
            <circle cx="29" cy="15" r="2.8" fill="#93C5FD" stroke="white" stroke-width="1.5" />
            <circle cx="8" cy="29" r="1.8" fill="white" />
        </svg>
    {/if}

    <div class="flex flex-col justify-center leading-none">
        <div class="flex items-center gap-1.5">
            <span
                class="font-brand font-black text-xl tracking-tight uppercase {invert ? 'text-white' : 'text-content'}"
            >
                TRACE<span class="text-primary">CLUB</span>
            </span>
            {#if showBadge}
                <span
                    class="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md {invert ? 'bg-white/15 text-blue-300 border border-white/20' : 'bg-primary/10 text-primary border border-primary/20'}"
                >
                    .CC
                </span>
            {/if}
        </div>
        {#if showSubtitle}
            <span
                class="text-[9px] uppercase font-semibold tracking-[0.22em] mt-0.5 {invert ? 'text-white/60' : 'text-content/50'}"
            >
                Traces & Récits
            </span>
        {/if}
    </div>
</div>
