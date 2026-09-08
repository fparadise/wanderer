<script lang="ts">
    import LogoTextLight from "./logo/logo_text_light.svelte";
    import { version } from "$app/environment";
    import { _ } from "svelte-i18n";
</script>

<footer class="bg-footer-background text-white w-full px-6 py-10 md:px-12 md:py-12 mt-16 rounded-t-3xl shadow-inner">
    <div class="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <!-- Identity & Based on Wanderer -->
        <div class="flex flex-col gap-3 max-w-lg">
            <div class="flex items-center gap-3">
                <a
                    href="https://wanderer.to"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="opacity-90 hover:opacity-100 transition-opacity"
                    title="Wanderer"
                >
                    <div class="w-36 sm:w-44 [&_svg]:w-full [&_svg]:h-auto">
                        <LogoTextLight />
                    </div>
                </a>
                <span class="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-neutral-300 font-mono">
                    v{version}
                </span>
            </div>
            <p class="text-sm text-neutral-300 leading-relaxed">
                {$_("footer-desc") || "Une plateforme d'itinéraires et d'aventures outdoor basée sur le projet open-source Wanderer."}
            </p>
        </div>

        <!-- Links: Donations & Contributions -->
        <div class="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <!-- Buy Me a Coffee -->
            <a
                href="https://www.buymeacoffee.com/wanderertrails"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="Buy Me a Coffee"
            >
                <i class="fa-solid fa-mug-hot text-amber-400"></i>
                <span>Buy Me a Coffee</span>
            </a>

            <!-- Liberapay -->
            <a
                href="https://liberapay.com/wanderer/"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="Liberapay"
            >
                <i class="fa-solid fa-heart text-rose-400"></i>
                <span>Liberapay</span>
            </a>

            <!-- Contribute: GitHub -->
            <a
                href="https://github.com/open-wanderer/wanderer"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="GitHub"
            >
                <i class="fa-brands fa-github text-base"></i>
                <span>{$_("contribute") || "Contribuer"}</span>
            </a>
        </div>
    </div>

    <!-- Bottom sub-bar -->
    <div class="max-w-6xl mx-auto border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-3">
        <div class="flex items-center gap-2 flex-wrap">
            <span>{$_("footer-based-on") || "Propulsé par"}</span>
            <a
                href="https://wanderer.to"
                target="_blank"
                rel="noopener noreferrer"
                class="text-white hover:underline font-medium"
            >
                Wanderer
            </a>
            <span>•</span>
            <a
                href="https://wanderer.to/run/installation/quick/"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-white transition-colors"
            >
                {$_("documentation") || "Documentation"}
            </a>
            <span>•</span>
            <a
                href="https://github.com/open-wanderer/wanderer/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-white transition-colors"
            >
                {$_("license") || "Licence AGPL-3.0"}
            </a>
        </div>

        <div>
            <span class="text-neutral-400/80">Open-source outdoor community</span>
        </div>
    </div>
</footer>
