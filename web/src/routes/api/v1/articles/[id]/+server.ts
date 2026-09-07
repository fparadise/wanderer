import type { Article } from '$lib/models/article';
import { Collection, handleError, uploadUpdate } from '$lib/util/api_util';
import { json, type RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
    try {
        const id = event.params.id!;
        const r = await event.locals.pb.collection(Collection.articles).getOne<Article>(id, {
            expand: "relation,author,participants",
        });
        return json(r);
    } catch (e) {
        return handleError(e);
    }
}

export async function POST(event: RequestEvent) {
    try {
        const id = event.params.id!;
        const data = await event.request.formData();
        const r = await event.locals.pb.collection(Collection.articles).update<Article>(id, data, {
            expand: "relation,author,participants",
        });
        return json(r);
    } catch (e) {
        return handleError(e);
    }
}

export async function DELETE(event: RequestEvent) {
    try {
        const id = event.params.id!;
        await event.locals.pb.collection(Collection.articles).delete(id);
        return json({ success: true });
    } catch (e) {
        return handleError(e);
    }
}
