<script lang="ts">
    import { goto } from "$app/navigation";
    import ArticleForm from "$lib/components/article/article_form.svelte";
    import type { Article } from "$lib/models/article";
    import { articles_create } from "$lib/stores/article_store";
    import { show_toast } from "$lib/stores/toast_store.svelte";

    async function handleSubmit(
        articleData: Partial<Article>,
        heroFiles: File[],
        deletedHeroImages: string[]
    ) {
        const created = await articles_create(articleData, heroFiles);
        show_toast({ type: "success", icon: "check", text: "Récit publié avec succès !" });
        goto(`/articles/${created.id}`);
    }
</script>

<svelte:head>
    <title>Rédiger un article | Magazine Wanderer</title>
</svelte:head>

<ArticleForm mode="create" onsubmit={handleSubmit} />
