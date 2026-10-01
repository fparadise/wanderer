import { articles_show } from '$lib/stores/article_store';
import { trails_show } from '$lib/stores/trail_store';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
    const article = await articles_show(params.id, fetch);

    if (article.expand?.relation && article.expand.relation.length > 0) {
        article.expand.relation = await Promise.all(
            article.expand.relation.map(async (trailSummary: any) => {
                try {
                    return await trails_show(trailSummary.id, undefined, undefined, false, fetch);
                } catch (e) {
                    console.warn(`Could not load full trail details for ${trailSummary.id}:`, e);
                    return trailSummary;
                }
            })
        );
    }

    return {
        article,
    };
};
