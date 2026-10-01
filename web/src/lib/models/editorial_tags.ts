export interface EditorialTagCategory {
    id: string;
    label: string;
    icon: string;
    tags: string[];
}

export const EDITORIAL_TAG_CATEGORIES: EditorialTagCategory[] = [
    {
        id: "practices",
        label: "Pratiques & Formats",
        icon: "person-biking",
        tags: [
            "Bikepacking",
            "Gravel",
            "Ultra-distance",
            "Route",
            "VTT",
            "Course & Épreuve",
            "Trail running",
        ],
    },
    {
        id: "style",
        label: "Ambiance & Terrain",
        icon: "campground",
        tags: [
            "Bivouac",
            "En autonomie",
            "Cols mythiques",
            "Singletrack",
            "Roulant & Piste",
            "Engagé & Technique",
            "Nocturne",
            "Micro-aventure",
            "Hivernal",
        ],
    },
    {
        id: "massifs",
        label: "Massifs & Régions",
        icon: "mountain",
        tags: [
            "Alpes",
            "Pyrénées",
            "Massif Central",
            "Jura",
            "Vosges",
            "Corse",
            "Bretagne",
            "Mont Ventoux",
            "Dolomites",
        ],
    },
    {
        id: "destinations",
        label: "Destinations & Échappées",
        icon: "earth-europe",
        tags: [
            "Espagne",
            "Italie",
            "Suisse",
            "Écosse",
            "Norvège",
            "Islande",
            "Maroc",
            "Balkans",
        ],
    },
];

export interface TechnicalDifficultyLevel {
    level: number;
    title: string;
    subtitle: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

export const TECHNICAL_DIFFICULTY_LEVELS: Record<number, TechnicalDifficultyLevel> = {
    1: {
        level: 1,
        title: "Niveau 1 - Très roulant",
        subtitle: "Voies vertes, asphalte, pistes stabilisées et lisses sans difficulté technique.",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/30",
    },
    2: {
        level: 2,
        title: "Niveau 2 - Facile",
        subtitle: "Pistes forestières, chemins ruraux bien entretenus, sans obstacle majeur.",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
    },
    3: {
        level: 3,
        title: "Niveau 3 - Modéré",
        subtitle: "Sentiers caillouteux, ornières, racines, singletracks avec petits franchissements.",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/30",
    },
    4: {
        level: 4,
        title: "Niveau 4 - Difficile",
        subtitle: "Terrain cassant, fortes pentes techniques, rochers, marches, pilotage engagé.",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
    },
    5: {
        level: 5,
        title: "Niveau 5 - Très difficile",
        subtitle: "Poussage ou portage fréquent, pierriers instables, passages trialisants ou exposés.",
        color: "text-neutral-950 dark:text-neutral-200",
        bgColor: "bg-neutral-900/10 dark:bg-neutral-100/10",
        borderColor: "border-neutral-900/30 dark:border-neutral-100/30",
    },
};
