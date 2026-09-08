import type { Trail } from "./trail";
import type { Actor } from "./activitypub/actor";

export class Article {
    id?: string;
    title: string;
    intro: string;
    body: string;
    hero_images: string[];
    total_distance: number;
    total_elevation_gain: number;
    total_days: number;
    date: string;
    relation: string[];
    author?: string;
    participants?: string[];
    tags: string[];
    technical_difficulty: number;
    featured?: boolean;
    excluded_photos?: string[];
    expand?: {
        relation?: Trail[];
        author?: Actor;
        participants?: Actor[];
    };
    created?: string;
    updated?: string;

    constructor(
        title: string = "",
        params?: {
            intro?: string;
            body?: string;
            hero_images?: string[];
            total_distance?: number;
            total_elevation_gain?: number;
            total_days?: number;
            date?: string;
            relation?: string[];
            author?: string;
            participants?: string[];
            tags?: string[];
            technical_difficulty?: number;
            featured?: boolean;
            excluded_photos?: string[];
            expand?: {
                relation?: Trail[];
                author?: Actor;
                participants?: Actor[];
            };
        }
    ) {
        this.title = title;
        this.intro = params?.intro ?? "";
        this.body = params?.body ?? "";
        this.hero_images = params?.hero_images ?? [];
        this.total_distance = params?.total_distance ?? 0;
        this.total_elevation_gain = params?.total_elevation_gain ?? 0;
        this.total_days = params?.total_days ?? 1;
        this.date = params?.date ?? new Date().toISOString().substring(0, 10);
        this.relation = params?.relation ?? [];
        this.author = params?.author;
        this.participants = params?.participants ?? [];
        this.tags = params?.tags ?? [];
        this.technical_difficulty = params?.technical_difficulty ?? 0;
        this.featured = params?.featured ?? false;
        this.excluded_photos = params?.excluded_photos ?? [];
        this.expand = params?.expand;
    }
}
