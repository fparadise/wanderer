<script lang="ts">
    import MagazineHome from "$lib/components/home/magazine_home.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<MagazineHome {data} />
