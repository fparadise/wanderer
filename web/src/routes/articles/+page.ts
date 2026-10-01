import { articles_index, type ArticleFilter } from '$lib/stores/article_store';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch }) => {
    const rawTags = url.searchParams.getAll("tag").concat(url.searchParams.getAll("tags"));
    const parsedTags = Array.from(
        new Set(
            rawTags
                .flatMap((t) => t.split(","))
                .map((t) => t.trim())
                .filter(Boolean)
        )
    );

    let difficultyMin: number | undefined = undefined;
    let difficultyMax: number | undefined = undefined;

    const diffMinParam = url.searchParams.get("difficulty_min") || url.searchParams.get("diff_min");
    const diffMaxParam = url.searchParams.get("difficulty_max") || url.searchParams.get("diff_max");
    if (diffMinParam) {
        const val = parseInt(diffMinParam, 10);
        if (!isNaN(val)) difficultyMin = val;
    }
    if (diffMaxParam) {
        const val = parseInt(diffMaxParam, 10);
        if (!isNaN(val)) difficultyMax = val;
    }

    const diffParam = url.searchParams.get("difficulty");
    if (diffParam) {
        if (diffParam.includes("-")) {
            const [p1, p2] = diffParam.split("-");
            const v1 = parseInt(p1, 10);
            const v2 = parseInt(p2, 10);
            if (!isNaN(v1)) difficultyMin = v1;
            if (!isNaN(v2)) difficultyMax = v2;
        } else if (difficultyMin === undefined && difficultyMax === undefined) {
            const v = parseInt(diffParam, 10);
            if (!isNaN(v)) {
                difficultyMin = v;
                difficultyMax = v;
            }
        }
    }

    const q = url.searchParams.get("q") || undefined;
    const sort = url.searchParams.get("sort") || "-created";
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    const filter: ArticleFilter = {
        tags: parsedTags,
        tag: parsedTags.join(","),
        q,
        difficultyMin,
        difficultyMax,
        sort,
    };

    try {
        const listResult = await articles_index(page, 50, filter, fetch);
        return {
            articles: listResult?.items || [],
            totalItems: listResult?.totalItems || 0,
            filter,
        };
    } catch (e) {
        console.error("Failed to load articles:", e);
        return {
            articles: [],
            totalItems: 0,
            filter,
        };
    }
};
