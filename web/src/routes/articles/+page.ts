import { articles_index } from '$lib/stores/article_store';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
    const listResult = await articles_index(1, 50, fetch);
    return {
        articles: listResult.items || [],
        totalItems: listResult.totalItems || 0,
    };
};
