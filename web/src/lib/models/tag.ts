import type { Trail } from "./trail";

export class Tag {
    id?: string;
    name: string;
    editorial?: boolean;

    constructor(name: string, editorial?: boolean) {
        this.name = name;
        this.editorial = editorial;
    }
}

export class TrailTag {
    id?: string;
    tag: Tag;
    trail: Trail;

    constructor(tag: Tag, trail: Trail) {
        this.tag = tag;
        this.trail = trail;
    }
}