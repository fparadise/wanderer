import type { Trail } from "$lib/models/trail";
import type { Article } from "$lib/models/article";
import { categories_index } from "$lib/stores/category_store";
import { subcategories_index } from "$lib/stores/subcategory_store";
import { articles_index } from "$lib/stores/article_store";
import type { Load } from "@sveltejs/kit";

export const load: Load = async ({ fetch }) => {
    try {
        const [_, __, articlesResult, recentTrailsRes, communityStatsRes] = await Promise.all([
            categories_index(fetch).catch(() => []),
            subcategories_index(fetch).catch(() => []),
            articles_index(1, 12, fetch).catch(() => ({ items: [], totalItems: 0 })),
            fetch("/api/v1/trail?perPage=3&sort=-date,-created&expand=category,subcategory,author,trail_share_via_trail,tags")
                .then((r) => (r.ok ? r.json() : { items: [] }))
                .catch(() => ({ items: [] })),
            fetch("/api/v1/community-stats")
                .then((r) => (r.ok ? r.json() : { usersCount: 0 }))
                .catch(() => ({ usersCount: 0 })),
        ]);

        const recentTrails = (recentTrailsRes?.items || []) as Trail[];
        const totalTrailsCount = (recentTrailsRes?.totalItems ?? recentTrails.length) as number;
        const registeredUsersCount = (communityStatsRes?.usersCount ?? 0) as number;

        return {
            articles: (articlesResult?.items || []) as Article[],
            recentTrails,
            totalTrailsCount,
            registeredUsersCount,
        };
    } catch (e) {
        if (!(e instanceof Error) || e.message !== "Unauthorized") {
            console.error(e);
        }
    }
    return {
        articles: [],
        recentTrails: [],
    };
};
