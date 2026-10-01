<script lang="ts">
    import { _ } from "svelte-i18n";
    import LogoTextLight from "$lib/components/logo/logo_text_light.svelte";
</script>

<svelte:head>
    <title>À propos | Trace Club</title>
</svelte:head>

<main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
    <!-- Header -->
    <header class="space-y-3 pb-8 border-b border-input-border">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            <i class="fa-solid fa-compass"></i>
            <span>{$_("about-page") || "À propos"}</span>
        </div>
        <h1 class="text-4xl sm:text-5xl font-serif font-extrabold text-content tracking-tight">
            À propos de <span class="text-primary">Trace Club</span>
        </h1>
        <p class="text-lg text-content/75 font-serif italic max-w-2xl">
            {$_("site-tagline") || "Récits d'aventures, cartographie et traces outdoor."}
        </p>
    </header>

    <!-- Main Editorial Placeholder -->
    <section class="prose dark:prose-invert max-w-none space-y-6 text-content/85 leading-relaxed">
        <div class="p-6 rounded-2xl bg-card/50 border border-input-border space-y-4">
            <h2 class="text-2xl font-serif font-bold text-content flex items-center gap-2">
                <i class="fa-solid fa-feather-pointed text-primary text-xl"></i>
                <span>Le projet</span>
            </h2>
            <p>
                Bienvenue sur <strong>Trace Club</strong> (traceclub.cc) ! Ce site rassemble des traces cartographiques, des récits d'aventures et des itinéraires d'exploration outdoor, à pied, à vélo ou à ski.
            </p>
            <p class="text-sm italic text-content/60 bg-primary/5 p-3 rounded-xl border border-primary/10">
                <i class="fa-solid fa-pen-ruler mr-1.5"></i>
                Cette page est actuellement en cours d'élaboration et sera enrichie très prochainement avec l'histoire et les détails du projet.
            </p>
        </div>

        <!-- Tech / Wanderer acknowledgment block -->
        <div class="p-6 rounded-2xl bg-footer-background text-white space-y-5 shadow-sm">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="space-y-1">
                    <span class="text-xs uppercase tracking-widest text-neutral-400 font-semibold">Fondation technique</span>
                    <h3 class="text-xl font-bold text-white">Propulsé par le projet libre Wanderer</h3>
                </div>
                <a
                    href="https://wanderer.to"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-36 [&_svg]:w-full [&_svg]:h-auto opacity-90 hover:opacity-100 transition-opacity"
                    title="Wanderer"
                >
                    <LogoTextLight />
                </a>
            </div>

            <p class="text-sm text-neutral-300 leading-relaxed">
                Ce site est construit sur la base de <strong>Wanderer</strong>, un logiciel open-source indépendant dédié à la gestion d'itinéraires GPS, de traces outdoor et au partage d'aventures.
            </p>

            <div class="pt-2 flex flex-wrap items-center gap-3">
                <a
                    href="https://www.buymeacoffee.com/wanderertrails"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
                >
                    <i class="fa-solid fa-mug-hot text-amber-400"></i>
                    <span>Buy Me a Coffee (Wanderer)</span>
                </a>
                <a
                    href="https://liberapay.com/wanderer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
                >
                    <i class="fa-solid fa-heart text-rose-400"></i>
                    <span>Liberapay (Wanderer)</span>
                </a>
                <a
                    href="https://github.com/open-wanderer/wanderer"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
                >
                    <i class="fa-brands fa-github"></i>
                    <span>Contribuer sur GitHub</span>
                </a>
            </div>
        </div>
    </section>
</main>
