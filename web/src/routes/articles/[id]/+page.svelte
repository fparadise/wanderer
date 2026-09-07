<script lang="ts">
    import { goto } from "$app/navigation";
    import MapWithElevationMaplibre from "$lib/components/trail/map_with_elevation_maplibre.svelte";
    import { articles_delete } from "$lib/stores/article_store";
    import { show_toast } from "$lib/stores/toast_store.svelte";
    import { currentUser } from "$lib/stores/user_store";
    import { getFileURL } from "$lib/util/file_util";
    import { formatDistance, formatElevation } from "$lib/util/format_util";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    let article = $derived(data.article);
    let linkedTrails = $derived(article.expand?.relation || []);
    let author = $derived(article.expand?.author);
    let participants = $derived(article.expand?.participants || []);

    let isAuthor = $derived(
        $currentUser &&
        (article.author === $currentUser.actor ||
         author?.user === $currentUser.id)
    );

    let mainHeroImage = $derived(
        article.hero_images && article.hero_images.length > 0
            ? getFileURL(article, article.hero_images[0])
            : null
    );

    let additionalImages = $derived(
        article.hero_images && article.hero_images.length > 1
            ? article.hero_images.slice(1).map((img) => getFileURL(article, img))
            : []
    );

    let deleting: boolean = $state(false);

    async function handleDelete() {
        if (!confirm("Voulez-vous vraiment supprimer cet article ?")) return;
        deleting = true;
        try {
            await articles_delete(article.id!);
            show_toast({ type: "success", icon: "check", text: "Article supprimé." });
            goto("/articles");
        } catch (e: any) {
            show_toast({ type: "error", icon: "close", text: e.message || "Erreur de suppression" });
        } finally {
            deleting = false;
        }
    }
</script>

<svelte:head>
    <title>{article.title} | Magazine Wanderer</title>
</svelte:head>

<article class="min-h-screen pb-20">
    <!-- Hero Cover Section -->
    {#if mainHeroImage}
        <div class="relative w-full h-[65vh] min-h-[480px] max-h-[750px] overflow-hidden bg-neutral-900">
            <img
                src={mainHeroImage}
                alt={article.title}
                class="w-full h-full object-cover object-center opacity-85 scale-[1.02] transform transition-transform duration-1000"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
            
            <div class="absolute inset-x-0 bottom-0 max-w-5xl mx-auto px-6 pb-12">
                <div class="space-y-4">
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase bg-primary text-white backdrop-blur-md shadow-md">
                        <i class="fa-solid fa-compass mr-1"></i> Récit de voyage
                    </div>
                    <h1 class="text-4xl md:text-6xl font-serif font-extrabold text-foreground tracking-tight leading-tight drop-shadow-sm">
                        {article.title}
                    </h1>
                </div>
            </div>
        </div>
    {:else}
        <div class="max-w-5xl mx-auto px-6 pt-12 pb-6">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase bg-primary/10 text-primary mb-4">
                <i class="fa-solid fa-compass mr-1"></i> Récit de voyage
            </div>
            <h1 class="text-4xl md:text-5xl font-serif font-extrabold text-foreground tracking-tight">
                {article.title}
            </h1>
        </div>
    {/if}

    <!-- Metadata & Stats Bar -->
    <div class="max-w-5xl mx-auto px-6 py-6 border-b">
        <div class="flex flex-wrap items-center justify-between gap-6">
            <!-- Author & Participants -->
            <div class="flex items-center gap-4">
                {#if author}
                    <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-primary shrink-0">
                        <img
                            src={author.icon ? getFileURL(author, author.icon) : `https://api.dicebear.com/7.x/initials/svg?seed=${author.preferred_username || 'A'}`}
                            alt={author.preferred_username || author.username}
                            class="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <p class="text-sm font-bold text-foreground">
                            {author.preferred_username || author.username}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Publié le {new Date(article.date || article.created || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                {/if}

                {#if participants.length > 0}
                    <div class="flex items-center gap-1.5 pl-4 border-l">
                        <span class="text-xs text-muted-foreground mr-1">Avec :</span>
                        {#each participants as p}
                            <span class="text-xs font-medium bg-card border px-2 py-0.5 rounded-full" title={p.preferred_username || p.username}>
                                {p.preferred_username || p.username}
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Stats Badges -->
            <div class="flex items-center gap-4 text-sm font-semibold">
                {#if article.total_distance > 0}
                    <div class="flex items-center gap-2 bg-card border px-3.5 py-1.5 rounded-xl shadow-xs">
                        <i class="fa-solid fa-route text-primary"></i>
                        <span>{article.total_distance} km</span>
                    </div>
                {/if}
                {#if article.total_elevation_gain > 0}
                    <div class="flex items-center gap-2 bg-card border px-3.5 py-1.5 rounded-xl shadow-xs">
                        <i class="fa-solid fa-mountain text-primary"></i>
                        <span>+{article.total_elevation_gain} m D+</span>
                    </div>
                {/if}
                {#if article.total_days > 0}
                    <div class="flex items-center gap-2 bg-card border px-3.5 py-1.5 rounded-xl shadow-xs">
                        <i class="fa-solid fa-calendar-day text-primary"></i>
                        <span>{article.total_days} {article.total_days > 1 ? 'jours' : 'jour'}</span>
                    </div>
                {/if}
            </div>

            <!-- Author Actions -->
            {#if isAuthor}
                <div class="flex items-center gap-2 ml-auto">
                    <button
                        type="button"
                        onclick={handleDelete}
                        disabled={deleting}
                        class="btn-icon hover:text-red-500"
                        title="Supprimer l'article"
                    >
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            {/if}
        </div>
    </div>

    <!-- Main Content Layout -->
    <div class="max-w-4xl mx-auto px-6 pt-12 space-y-12">
        <!-- Chapô -->
        {#if article.intro}
            <div class="text-xl md:text-2xl font-serif italic text-foreground/90 leading-relaxed pl-6 border-l-4 border-primary">
                {article.intro}
            </div>
        {/if}

        <!-- Interactive Map of Linked Trails -->
        {#if linkedTrails.length > 0}
            <div class="space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="text-xs font-bold uppercase tracking-wider text-primary">Cartographie</span>
                        <h2 class="text-xl font-bold text-foreground">Tracé interactif de l'itinéraire</h2>
                    </div>
                    <span class="text-xs text-muted-foreground">
                        {linkedTrails.length} {linkedTrails.length > 1 ? 'étapes reliées' : 'étape reliée'}
                    </span>
                </div>

                <div class="w-full h-[450px] rounded-2xl overflow-hidden border shadow-sm relative">
                    <MapWithElevationMaplibre
                        trails={linkedTrails}
                        showElevation={true}
                        showFullscreen={true}
                        showStyleSwitcher={true}
                    />
                </div>

                <!-- Stages Breakdown -->
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                    {#each linkedTrails as trail, idx}
                        <div class="p-3.5 rounded-xl border bg-card hover:border-primary/50 transition-colors flex items-center justify-between">
                            <div class="min-w-0 pr-3">
                                <span class="text-[10px] font-bold uppercase tracking-wider text-primary">Étape {idx + 1}</span>
                                <h4 class="text-sm font-semibold truncate text-foreground">{trail.name}</h4>
                                <p class="text-xs text-muted-foreground">
                                    {Math.round((trail.distance || 0) / 1000)} km · +{Math.round(trail.elevation_gain || 0)} m
                                </p>
                            </div>
                            <div class="flex items-center gap-1">
                                {#if trail.gpx}
                                    <a
                                        href={getFileURL(trail, trail.gpx)}
                                        download
                                        class="w-8 h-8 rounded-lg bg-card hover:bg-menu-item-background-hover flex items-center justify-center text-muted-foreground hover:text-foreground border transition-colors"
                                        title="Télécharger GPX"
                                    >
                                        <i class="fa-solid fa-download text-xs"></i>
                                    </a>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Body Copy -->
        {#if article.body}
            <div class="prose prose-lg dark:prose-invert max-w-none font-serif leading-relaxed text-foreground/90">
                {@html article.body}
            </div>
        {/if}

        <!-- Gallery of Additional Photos -->
        {#if additionalImages.length > 0}
            <div class="space-y-4 pt-8 border-t">
                <h3 class="text-xl font-bold font-serif text-foreground">Galerie photos du périple</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {#each additionalImages as image}
                        <div class="aspect-4/3 rounded-2xl overflow-hidden border shadow-xs group">
                            <img
                                src={image}
                                alt="Photo de l'article"
                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</article>
