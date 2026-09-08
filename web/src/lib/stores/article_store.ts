import { Article } from "$lib/models/article";
import { APIError } from "$lib/util/api_util";
import { objectToFormData } from "$lib/util/file_util";
import type { ListResult } from "pocketbase";
import { get, writable, type Writable } from "svelte/store";
import { currentUser } from "./user_store";

export const articles: Writable<Article[]> = writable([]);
export const currentArticle: Writable<Article | null> = writable(null);

export async function articles_index(
    page: number = 1,
    perPage: number = 20,
    f: (url: RequestInfo | URL, config?: RequestInit) => Promise<Response> = fetch
): Promise<ListResult<Article>> {
    const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
        sort: "-created",
        expand: "relation,author,participants",
    });

    const r = await f(`/api/v1/articles?${params.toString()}`, {
        method: "GET",
    });

    if (!r.ok) {
        const response = await r.json().catch(() => ({}));
        throw new APIError(r.status, response.message || "Failed to fetch articles", response.detail);
    }

    const result: ListResult<Article> = await r.json();
    articles.set(result.items);
    return result;
}

export async function articles_show(
    id: string,
    f: (url: RequestInfo | URL, config?: RequestInit) => Promise<Response> = fetch
): Promise<Article> {
    const r = await f(`/api/v1/articles/${id}`, {
        method: "GET",
    });

    if (!r.ok) {
        const response = await r.json().catch(() => ({}));
        throw new APIError(r.status, response.message || "Failed to fetch article", response.detail);
    }

    const result: Article = await r.json();
    currentArticle.set(result);
    return result;
}

export async function articles_create(
    articleData: Partial<Article>,
    heroFiles: File[] = [],
    f: (url: RequestInfo | URL, config?: RequestInit) => Promise<Response> = fetch
): Promise<Article> {
    const user = get(currentUser);
    const formData = new FormData();

    formData.append("title", articleData.title || "");
    formData.append("intro", articleData.intro || "");
    formData.append("body", articleData.body || "");
    formData.append("total_distance", (articleData.total_distance ?? 0).toString());
    formData.append("total_elevation_gain", (articleData.total_elevation_gain ?? 0).toString());
    formData.append("total_days", (articleData.total_days ?? 1).toString());
    formData.append("date", articleData.date || new Date().toISOString().substring(0, 10));
    formData.append("technical_difficulty", (articleData.technical_difficulty ?? 0).toString());
    formData.append("tags", JSON.stringify(articleData.tags || []));
    if (articleData.featured !== undefined) {
        formData.append("featured", articleData.featured ? "true" : "false");
    }

    if (user?.actor) {
        formData.append("author", user.actor);
    }

    for (const trailId of articleData.relation || []) {
        formData.append("relation", trailId);
    }

    for (const participantId of articleData.participants || []) {
        formData.append("participants", participantId);
    }

    for (const file of heroFiles) {
        formData.append("hero_images", file);
    }

    const r = await f("/api/v1/articles", {
        method: "PUT",
        body: formData,
    });

    if (!r.ok) {
        const response = await r.json().catch(() => ({}));
        throw new APIError(r.status, response.message || "Failed to create article", response.detail);
    }

    const created: Article = await r.json();
    return created;
}

export async function articles_update(
    id: string,
    articleData: Partial<Article>,
    heroFiles: File[] = [],
    deletedHeroImages: string[] = [],
    f: (url: RequestInfo | URL, config?: RequestInit) => Promise<Response> = fetch
): Promise<Article> {
    const formData = new FormData();

    if (articleData.title !== undefined) formData.append("title", articleData.title);
    if (articleData.intro !== undefined) formData.append("intro", articleData.intro);
    if (articleData.body !== undefined) formData.append("body", articleData.body);
    if (articleData.total_distance !== undefined) formData.append("total_distance", articleData.total_distance.toString());
    if (articleData.total_elevation_gain !== undefined) formData.append("total_elevation_gain", articleData.total_elevation_gain.toString());
    if (articleData.total_days !== undefined) formData.append("total_days", articleData.total_days.toString());
    if (articleData.date !== undefined) formData.append("date", articleData.date);
    if (articleData.technical_difficulty !== undefined) formData.append("technical_difficulty", articleData.technical_difficulty.toString());
    if (articleData.tags !== undefined) formData.append("tags", JSON.stringify(articleData.tags));
    if (articleData.featured !== undefined) formData.append("featured", articleData.featured ? "true" : "false");

    if (articleData.relation !== undefined) {
        for (const trailId of articleData.relation) {
            formData.append("relation", trailId);
        }
    }

    if (articleData.participants !== undefined) {
        for (const pId of articleData.participants) {
            formData.append("participants", pId);
        }
    }

    for (const file of heroFiles) {
        formData.append("hero_images", file);
    }

    for (const deletedImg of deletedHeroImages) {
        formData.append("hero_images-", deletedImg.replace(/^.*[\\/]/, ""));
    }

    const r = await f(`/api/v1/articles/${id}`, {
        method: "POST",
        body: formData,
    });

    if (!r.ok) {
        const response = await r.json().catch(() => ({}));
        throw new APIError(r.status, response.message || "Failed to update article", response.detail);
    }

    const updated: Article = await r.json();
    return updated;
}

export async function articles_delete(
    id: string,
    f: (url: RequestInfo | URL, config?: RequestInit) => Promise<Response> = fetch
): Promise<void> {
    const r = await f(`/api/v1/articles/${id}`, {
        method: "DELETE",
    });

    if (!r.ok) {
        const response = await r.json().catch(() => ({}));
        throw new APIError(r.status, response.message || "Failed to delete article", response.detail);
    }
}
