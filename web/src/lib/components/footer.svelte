<script lang="ts">
    import LogoTextLight from "./logo/logo_text_light.svelte";
    import { version } from "$app/environment";
    import { _ } from "svelte-i18n";
</script>

<footer class="bg-footer-background text-white w-full px-6 py-12 md:px-12 mt-16 rounded-t-3xl shadow-inner border-t border-white/5">
    <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        <!-- Bloc 1: Identité du site traceclub.cc -->
        <div class="lg:col-span-5 space-y-4">
            <div class="space-y-3">
                <a href="/" class="inline-block">
                    <span class="text-2xl sm:text-3xl font-serif font-black tracking-tight text-white hover:opacity-90 transition-opacity">
                        TraceClub
                    </span>
                </a>
                <p class="text-sm text-neutral-300 leading-relaxed">
                    {$_("site-tagline") || "Récits d'aventures, cartographie et traces outdoor."}
                </p>
            </div>

            <!-- Liens propres au site traceclub.cc -->
            <nav class="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <a
                    href="/about"
                    class="text-neutral-300 hover:text-white underline-offset-4 hover:underline transition-colors flex items-center gap-1.5"
                >
                    <i class="fa-solid fa-circle-info text-xs opacity-75"></i>
                    <span>{$_("about-page") || "À propos"}</span>
                </a>
                <span class="text-neutral-600">•</span>
                <a
                    href="/legal"
                    class="text-neutral-300 hover:text-white underline-offset-4 hover:underline transition-colors flex items-center gap-1.5"
                >
                    <i class="fa-solid fa-scale-balanced text-xs opacity-75"></i>
                    <span>{$_("legal-notice") || "Mentions légales"}</span>
                </a>
            </nav>
        </div>

        <!-- Bloc 2: Socle technique Wanderer & Dons (clairement rattachés à Wanderer) -->
        <div class="lg:col-span-7 bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-center gap-2.5">
                    <span class="text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                        {$_("footer-based-on") || "Propulsé par"}
                    </span>
                    <a
                        href="https://wanderer.to"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="w-28 sm:w-32 [&_svg]:w-full [&_svg]:h-auto opacity-95 hover:opacity-100 transition-opacity"
                        title="Wanderer"
                    >
                        <LogoTextLight />
                    </a>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full bg-white/10 text-neutral-400 font-mono self-start sm:self-auto">
                    v{version}
                </span>
            </div>

            <p class="text-xs sm:text-sm text-neutral-300/90 leading-relaxed">
                {$_("support-wanderer-desc") || "Ce site est propulsé par le logiciel libre Wanderer. Vous pouvez soutenir son développement indépendant ou y contribuer :"}
            </p>

            <!-- Actions de dons et contributions pour Wanderer -->
            <div class="flex flex-wrap items-center gap-2.5 pt-1">
                <a
                    href="https://www.buymeacoffee.com/wanderertrails"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Faire un don à Wanderer via Buy Me a Coffee"
                >
                    <i class="fa-solid fa-mug-hot text-amber-400"></i>
                    <span>Buy Me a Coffee (Wanderer)</span>
                </a>

                <a
                    href="https://liberapay.com/wanderer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Faire un don à Wanderer via Liberapay"
                >
                    <i class="fa-solid fa-heart text-rose-400"></i>
                    <span>Liberapay (Wanderer)</span>
                </a>

                <a
                    href="https://github.com/open-wanderer/wanderer"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Contribuer au code de Wanderer sur GitHub"
                >
                    <i class="fa-brands fa-github text-sm"></i>
                    <span>Contribuer sur GitHub</span>
                </a>

                <a
                    href="https://wanderer.to/run/installation/quick/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white px-2 py-1.5 transition-colors"
                    title="Documentation officielle Wanderer"
                >
                    <i class="fa-solid fa-book-open text-xs"></i>
                    <span>Documentation</span>
                </a>
            </div>
        </div>
    </div>

    <!-- Barre inférieure discrète -->
    <div class="max-w-6xl mx-auto border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-3">
        <div>
            <span>© {new Date().getFullYear()} traceclub.cc</span>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
            <span>Moteur logiciel sous licence libre</span>
            <a
                href="https://github.com/open-wanderer/wanderer/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                class="text-neutral-300 hover:text-white underline transition-colors"
            >
                GNU AGPL-3.0
            </a>
        </div>
    </div>
</footer>
