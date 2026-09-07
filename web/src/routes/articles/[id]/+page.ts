import { articles_show } from '$lib/stores/article_store';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
    const article = await articles_show(params.id, fetch);
    return {
        article,
    };
};
