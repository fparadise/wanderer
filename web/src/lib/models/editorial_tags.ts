export interface EditorialTagCategory {
    id: string;
    label: string;
    icon: string;
    tags: string[];
}

export const EDITORIAL_TAG_CATEGORIES: EditorialTagCategory[] = [
    {
        id: "practices",
        label: "Pratiques",
        icon: "person-biking",
        tags: [
            "Bikepacking",
            "Gravel",
            "VTT",
            "Randonnée / Trekking",
            "Trail running",
            "Alpinisme",
            "Ski de rando",
            "Canoë / Packraft",
            "Cyclotourisme",
        ],
    },
    {
        id: "territories",
        label: "Territoires & Massifs",
        icon: "mountain",
        tags: [
            "Alpes",
            "Pyrénées",
            "Vosges",
            "Jura",
            "Massif Central",
            "Corse",
            "Bretagne",
            "Suisse",
            "Italie",
            "Dolomites",
            "Espagne",
            "Norvège",
            "Islande",
        ],
    },
    {
        id: "themes",
        label: "Thématiques & Style",
        icon: "campground",
        tags: [
            "Bivouac",
            "En autonomie",
            "En refuge",
            "Ultra-distance",
            "Hivernal",
            "En famille",
            "Micro-aventure",
            "Itinérance au long cours",
            "Cols mythiques",
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
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/30",
    },
    2: {
        level: 2,
        title: "Niveau 2 - Facile",
        subtitle: "Pistes forestières, chemins ruraux bien entretenus, sans obstacle majeur.",
        color: "text-lime-500",
        bgColor: "bg-lime-500/10",
        borderColor: "border-lime-500/30",
    },
    3: {
        level: 3,
        title: "Niveau 3 - Modéré",
        subtitle: "Sentiers caillouteux, ornières, racines, singletracks avec petits franchissements.",
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/30",
    },
    4: {
        level: 4,
        title: "Niveau 4 - Difficile",
        subtitle: "Terrain cassant, fortes pentes techniques, rochers, marches, pilotage engagé.",
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/30",
    },
    5: {
        level: 5,
        title: "Niveau 5 - Très difficile",
        subtitle: "Poussage ou portage fréquent, pierriers instables, passages trialisants ou exposés.",
        color: "text-rose-500",
        bgColor: "bg-rose-500/10",
        borderColor: "border-rose-500/30",
    },
};
