export interface ArticleMediaItem {
    id: string;
    url: string;
    sourceTrailId: string;
    sourceTrailName: string;
    stageIndex: number;
    stageLabel: string;
    lat?: number;
    lon?: number;
    pkKm?: number;
    caption?: string;
    type: "trail_photo" | "waypoint_photo" | "summit_photo" | "custom_upload";
}
