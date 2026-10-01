import type { Article } from '$lib/models/article';
import { Collection, handleError, list, uploadCreate } from '$lib/util/api_util';
import { json, type RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
    try {
        const r = await list<Article>(event, Collection.articles);
        return json(r);
    } catch (e) {
        return handleError(e);
    }
}

export async function PUT(event: RequestEvent) {
    try {
        const r = await uploadCreate<Article>(event, Collection.articles);
        return json(r, { status: 201 });
    } catch (e) {
        return handleError(e);
    }
}
