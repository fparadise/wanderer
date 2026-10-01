import { Article } from "$lib/models/article";
import { APIError } from "$lib/util/api_util";
import { objectToFormData } from "$lib/util/file_util";
import type { ListResult } from "pocketbase";
import { get, writable, type Writable } from "svelte/store";
import { currentUser } from "./user_store";

export interface ArticleFilter {
    tag?: string;
    tags?: string[];
    q?: string;
    difficultyMin?: number;
    difficultyMax?: number;
    difficulty?: number | string;
    difficulties?: (number | string)[];
    sort?: string;
}

export const articles: Writable<Article[]> = writable([]);
export const currentArticle: Writable<Article | null> = writable(null);

export async function articles_index(
    page: number = 1,
    perPage: number = 20,
    filterOrFetch?: ArticleFilter | ((url: RequestInfo | URL, config?: RequestInit) => Promise<Response>),
    f: (url: RequestInfo | URL, config?: RequestInit) => Promise<Response> = fetch
): Promise<ListResult<Article>> {
    let filter: ArticleFilter | undefined;
    let customFetch = f;

    if (typeof filterOrFetch === "function") {
        customFetch = filterOrFetch;
    } else {
        filter = filterOrFetch;
    }

    const filterParts: string[] = [];

    // 1. Tags en logique ET (Intersection : chaque tag affine la recherche)
    const rawTags: string[] = [];
    if (filter?.tags && Array.isArray(filter.tags) && filter.tags.length > 0) {
        rawTags.push(...filter.tags);
    } else if (filter?.tag) {
        rawTags.push(...filter.tag.split(",").map((t) => t.trim()).filter(Boolean));
    }

    if (rawTags.length > 0) {
        rawTags.forEach((t) => {
            const safeTag = t.replace(/'/g, "\\'");
            filterParts.push(`tags ~ '${safeTag}'`);
        });
    }

    // 2. Recherche textuelle
    if (filter?.q && filter.q.trim()) {
        const safeQ = filter.q.trim().replace(/'/g, "\\'");
        filterParts.push(`(title ~ '${safeQ}' || intro ~ '${safeQ}')`);
    }

    // 3. Difficulté technique : Plage [min - max] (Double Slider)
    let minDiff = filter?.difficultyMin;
    let maxDiff = filter?.difficultyMax;

    // Prise en charge du format chaîne "min-max" (ex: "1-3")
    if (minDiff === undefined && maxDiff === undefined && filter?.difficulty) {
        const strDiff = filter.difficulty.toString();
        if (strDiff.includes("-")) {
            const [sMin, sMax] = strDiff.split("-");
            const pMin = parseInt(sMin, 10);
            const pMax = parseInt(sMax, 10);
            if (!isNaN(pMin)) minDiff = pMin;
            if (!isNaN(pMax)) maxDiff = pMax;
        }
    }

    if (minDiff !== undefined || maxDiff !== undefined) {
        const min = minDiff ?? 1;
        const max = maxDiff ?? 5;
        // Filtrer uniquement si différent de la plage totale complète [1 - 5]
        if (min > 1 || max < 5) {
            filterParts.push(`(technical_difficulty >= ${min} && technical_difficulty <= ${max})`);
        }
    } else {
        // Fallback rétrocompatible pour tableau discret de difficultés
        const rawDiffs: (number | string)[] = [];
        if (filter?.difficulties && Array.isArray(filter.difficulties) && filter.difficulties.length > 0) {
            rawDiffs.push(...filter.difficulties);
        } else if (
            filter?.difficulty !== undefined &&
            filter.difficulty !== "" &&
            filter.difficulty !== null &&
            filter.difficulty !== "all"
        ) {
            if (typeof filter.difficulty === "string" && filter.difficulty.includes(",")) {
                rawDiffs.push(...filter.difficulty.split(",").map((d) => d.trim()).filter(Boolean));
            } else {
                rawDiffs.push(filter.difficulty);
            }
        }

        if (rawDiffs.length > 0) {
            const diffClauses = rawDiffs.map((d) => `technical_difficulty = ${d}`);
            filterParts.push(`(${diffClauses.join(" || ")})`);
        }
    }

    const filterString = filterParts.join(" && ");

    const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
        sort: filter?.sort || "-created",
        expand: "relation,author,participants,lists",
    });

    if (filterString) {
        params.set("filter", filterString);
    }

    const r = await customFetch(`/api/v1/articles?${params.toString()}`, {
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
    if (articleData.excluded_photos !== undefined) {
        formData.append("excluded_photos", JSON.stringify(articleData.excluded_photos));
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

    for (const listId of articleData.lists || []) {
        formData.append("lists", listId);
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
    if (articleData.excluded_photos !== undefined) formData.append("excluded_photos", JSON.stringify(articleData.excluded_photos));

    if (articleData.relation !== undefined) {
        if (articleData.relation.length === 0) {
            formData.append("relation", "");
        } else {
            for (const trailId of articleData.relation) {
                formData.append("relation", trailId);
            }
        }
    }

    if (articleData.participants !== undefined) {
        if (articleData.participants.length === 0) {
            formData.append("participants", "");
        } else {
            for (const pId of articleData.participants) {
                formData.append("participants", pId);
            }
        }
    }

    if (articleData.lists !== undefined) {
        if (articleData.lists.length === 0) {
            formData.append("lists", "");
        } else {
            for (const listId of articleData.lists) {
                formData.append("lists", listId);
            }
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
