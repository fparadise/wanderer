import { type Tag } from "$lib/models/tag";
import { APIError } from "$lib/util/api_util";
import type { ListResult } from "pocketbase";
import { writable, type Writable } from "svelte/store";

let tags: Writable<Tag[]> = writable([]);


export async function tags_index(name: string, f: (url: RequestInfo | URL, config?: RequestInit) => Promise<Response> = fetch) {
    const r = await f('/api/v1/tag?' + new URLSearchParams({
        filter: `name~'${name}'`,
    }), {
        method: 'GET',
    })

    if (!r.ok) {
        const response = await r.json();
        throw new APIError(r.status, response.message, response.detail)
    }

    const response: ListResult<Tag> = await r.json();

    tags.set(response.items);

    return response;

}

export async function editorial_tags_index(f: (url: RequestInfo | URL, config?: RequestInit) => Promise<Response> = fetch): Promise<Tag[]> {
    try {
        const r = await f('/api/v1/tag?' + new URLSearchParams({
            filter: 'editorial=true',
            perPage: '100',
            sort: 'name',
        }), {
            method: 'GET',
        });

        if (!r.ok) {
            return [];
        }

        const response: ListResult<Tag> = await r.json();
        return response.items;
    } catch {
        return [];
    }
}

export async function tags_create(tag: Tag) {
    let r = await fetch('/api/v1/tag', {
        method: 'PUT',
        body: JSON.stringify(tag),
    })

    if (!r.ok) {
        const response = await r.json();
        throw new APIError(r.status, response.message, response.detail)
    }

    return await r.json();
}

/**
 * Ensures a list of tag names exists in PocketBase tags collection.
 * Creates any missing tags automatically in the shared repository.
 */
export async function tags_ensure(tagNames: string[]): Promise<void> {
    for (const name of tagNames) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        try {
            const existing = await tags_index(trimmed);
            const found = existing.items.some(
                (t) => t.name.toLowerCase() === trimmed.toLowerCase()
            );
            if (!found) {
                await tags_create({ name: trimmed });
            }
        } catch (e) {
            console.warn(`Could not ensure tag "${trimmed}":`, e);
        }
    }
}