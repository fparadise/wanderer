<script lang="ts">
    import { goto } from "$app/navigation";
    import ArticleForm from "$lib/components/article/article_form.svelte";
    import type { Article } from "$lib/models/article";
    import { articles_update, articles_delete } from "$lib/stores/article_store";
    import { show_toast } from "$lib/stores/toast_store.svelte";
    import { currentUser } from "$lib/stores/user_store";
    import { onMount } from "svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    let article = $derived(data.article);

    let isAuthor = $derived(
        Boolean(
            $currentUser &&
            (article.author === $currentUser.actor ||
             article.expand?.author?.user === $currentUser.id)
        )
    );

    let isParticipant = $derived(
        Boolean(
            $currentUser &&
            (article.participants?.includes($currentUser.actor ?? "") ||
             article.expand?.participants?.some(
                 (p) => p.user === $currentUser.id || p.id === $currentUser.actor
             ))
        )
    );

    let canEdit = $derived(
        Boolean(
            $currentUser &&
            (isAuthor || isParticipant || $currentUser.is_admin === true)
        )
    );

    let canDelete = $derived(
        Boolean(
            $currentUser &&
            (isAuthor || $currentUser.is_admin === true)
        )
    );

    onMount(() => {
        if (!canEdit) {
            show_toast({
                type: "error",
                icon: "close",
                text: "Vous n'avez pas l'autorisation de modifier ce récit.",
            });
            goto(`/articles/${article.id}`);
        }
    });

    async function handleSubmit(
        articleData: Partial<Article>,
        heroFiles: File[],
        deletedHeroImages: string[]
    ) {
        const updated = await articles_update(
            article.id!,
            articleData,
            heroFiles,
            deletedHeroImages
        );
        show_toast({
            type: "success",
            icon: "check",
            text: "Récit mis à jour avec succès !",
        });
        goto(`/articles/${updated.id}`);
    }

    async function handleDelete() {
        if (!canDelete) {
            show_toast({
                type: "error",
                icon: "close",
                text: "Seul l'auteur principal peut supprimer ce récit.",
            });
            return;
        }
        await articles_delete(article.id!);
        show_toast({
            type: "success",
            icon: "check",
            text: "Récit supprimé définitivement.",
        });
        goto("/articles");
    }
</script>

<svelte:head>
    <title>Modifier : {article.title} | Magazine Wanderer</title>
</svelte:head>

{#if canEdit}
    <ArticleForm
        mode="edit"
        initialArticle={article}
        canDelete={canDelete}
        onsubmit={handleSubmit}
        ondelete={canDelete ? handleDelete : undefined}
    />
{/if}
