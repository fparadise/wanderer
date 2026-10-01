<script lang="ts">
    import { _ } from "svelte-i18n";
</script>

<svelte:head>
    <title>Mentions légales | Trace Club</title>
</svelte:head>

<main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
    <!-- Header -->
    <header class="space-y-3 pb-8 border-b border-input-border">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            <i class="fa-solid fa-scale-balanced"></i>
            <span>{$_("legal-notice") || "Mentions légales"}</span>
        </div>
        <h1 class="text-4xl sm:text-5xl font-serif font-extrabold text-content tracking-tight">
            Mentions légales
        </h1>
        <p class="text-base text-content/75 font-serif italic max-w-2xl">
            Informations juridiques concernant le site <strong>traceclub.cc</strong> (Trace Club)
        </p>
    </header>

    <div class="space-y-8 text-content/85 leading-relaxed text-sm">
        <!-- Éditeur -->
        <section class="p-6 rounded-2xl bg-card/50 border border-input-border space-y-3">
            <h2 class="text-xl font-serif font-bold text-content flex items-center gap-2">
                <i class="fa-solid fa-user-pen text-primary"></i>
                <span>1. Édition du site</span>
            </h2>
            <p>
                Le site <strong>traceclub.cc</strong> est un site personnel édité à titre non professionnel / associatif.
            </p>
            <ul class="list-disc list-inside space-y-1 text-content/70 pl-2">
                <li><strong>Responsable de publication :</strong> [Nom / Prénom ou Alias de l'éditeur]</li>
                <li><strong>Contact :</strong> [Adresse e-mail de contact]</li>
            </ul>
        </section>

        <!-- Hébergement -->
        <section class="p-6 rounded-2xl bg-card/50 border border-input-border space-y-3">
            <h2 class="text-xl font-serif font-bold text-content flex items-center gap-2">
                <i class="fa-solid fa-server text-primary"></i>
                <span>2. Hébergement</span>
            </h2>
            <p>
                Le site et ses données sont hébergés par :
            </p>
            <ul class="list-disc list-inside space-y-1 text-content/70 pl-2">
                <li><strong>Hébergeur :</strong> [Nom de l'hébergeur, ex: OVH / Infomaniak / Hetzner / Auto-hébergé]</li>
                <li><strong>Adresse / Site web :</strong> [Coordonnées de l'hébergeur]</li>
            </ul>
        </section>

        <!-- Propriété intellectuelle -->
        <section class="p-6 rounded-2xl bg-card/50 border border-input-border space-y-3">
            <h2 class="text-xl font-serif font-bold text-content flex items-center gap-2">
                <i class="fa-solid fa-copyright text-primary"></i>
                <span>3. Propriété intellectuelle & Contenus</span>
            </h2>
            <p>
                L'ensemble des contenus (textes, photographies, récits, traces et itinéraires GPS) publiés sur le site <strong>traceclub.cc</strong> restent la propriété exclusive de leurs auteurs respectifs, sauf mention contraire expresse.
            </p>
            <p>
                La plateforme logicielle sous-jacente est basée sur le logiciel libre <strong>Wanderer</strong>, distribué sous licence <a href="https://github.com/open-wanderer/wanderer/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary-hover">GNU AGPLv3</a>.
            </p>
        </section>

        <!-- Données personnelles -->
        <section class="p-6 rounded-2xl bg-card/50 border border-input-border space-y-3">
            <h2 class="text-xl font-serif font-bold text-content flex items-center gap-2">
                <i class="fa-solid fa-shield-halved text-primary"></i>
                <span>4. Protection des données personnelles & Cookies</span>
            </h2>
            <p>
                Ce site n'utilise aucun traqueur publicitaire tiers. Les seules données collectées sont strictement nécessaires au bon fonctionnement de l'application (authentification, gestion des comptes utilisateurs et enregistrement des préférences).
            </p>
            <p>
                Conformément à la réglementation applicable (RGPD), vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles en contactant l'administrateur du site.
            </p>
        </section>
    </div>
</main>
