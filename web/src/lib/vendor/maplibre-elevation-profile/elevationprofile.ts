import type {
    Feature,
    FeatureCollection,
    GeoJsonObject,
    GeometryObject,
    LineString,
    MultiLineString,
    Position,
} from "geojson";

import { Chart, registerables } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
// @ts-ignore
import { CrosshairPlugin } from "chartjs-plugin-crosshair";

import { haversineDistance } from "$lib/models/gpx/utils";
import type { Waypoint } from "$lib/models/waypoint";
import { formatTimeHHMM } from "$lib/util/format_util";
import { haversineCumulatedDistanceWgs84, smoothElevations } from "./tools";

const FEET_PER_METER = 3.28084;
const MILES_PER_METER = 0.000621371;
const KILOMETERS_HOUR_PER_METER_SECOND = 3.6
const MILES_HOUR_PER_METER_SECOND = 2.23694

function extractLineStrings(
    geoJson: GeoJsonObject
): { lineStrings: Array<LineString | MultiLineString>, times: Date[] } {
    const lineStrings: Array<LineString | MultiLineString> = [];
    const times: Date[] = [];

    function extractFromGeometry(geometry: GeometryObject) {
        if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
            lineStrings.push(geometry as LineString | MultiLineString);
        }
    }

    function extractFromFeature(feature: Feature) {
        if (feature.geometry) {
            extractFromGeometry(feature.geometry);
        }
        if (feature.properties?.coordinateProperties?.times) {
            const coordinateTimes = feature.properties?.coordinateProperties?.times.map((t: string) => new Date(t))
            times.push(...coordinateTimes)
        }
    }

    function extractFromFeatureCollection(collection: FeatureCollection) {
        for (const feature of collection.features) {
            if (feature.type === "Feature") {
                extractFromFeature(feature);
            } else if (feature.type === "FeatureCollection") {
                extractFromFeatureCollection(feature as unknown as FeatureCollection); // had to add unknown
            }
        }
    }

    if (geoJson.type === "Feature") {
        extractFromFeature(geoJson as Feature);
    } else if (geoJson.type === "FeatureCollection") {
        extractFromFeatureCollection(geoJson as FeatureCollection);
    } else {
        // It's a single geometry
        extractFromGeometry(geoJson as GeometryObject);
    }

    return { lineStrings, times };
}

function geoJsonObjectToPositionsAndTimes(geoJson: GeoJsonObject): { positions: Position[], times: Date[] } {
    const { lineStrings, times } = extractLineStrings(geoJson);
    const positionsGroups: Position[][] = [];

    for (let i = 0; i < lineStrings.length; i += 1) {
        const feature = lineStrings[i];
        if (feature.type === "LineString") {
            positionsGroups.push(feature.coordinates);
        } else if (feature.type === "MultiLineString") {
            positionsGroups.push(feature.coordinates.flat());
        }
    }
    return { positions: positionsGroups.flat(), times };
}

export interface StageInfo {
    stageIndex: number;
    name: string;
    color: string;
    startIndex: number;
    endIndex: number;
    startDistance: number;
    endDistance: number;
    totalDistance: number;
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (typeof (ctx as any).roundRect === "function") {
        ctx.beginPath();
        (ctx as any).roundRect(x, y, w, h, r);
    } else {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

function extractStagesAndPositions(geoJson: GeoJsonObject): {
    stages: Array<{
        stageIndex: number;
        name: string;
        color: string;
        positions: Position[];
    }>;
    times: Date[];
} {
    const stages: Array<{
        stageIndex: number;
        name: string;
        color: string;
        positions: Position[];
    }> = [];
    const times: Date[] = [];

    function processFeature(feature: Feature, defaultIndex: number) {
        if (!feature.geometry) return;
        const coords: Position[] = [];
        if (feature.geometry.type === "LineString") {
            coords.push(...feature.geometry.coordinates);
        } else if (feature.geometry.type === "MultiLineString") {
            coords.push(...feature.geometry.coordinates.flat());
        }
        if (coords.length > 0) {
            stages.push({
                stageIndex: feature.properties?.stageIndex ?? defaultIndex,
                name: feature.properties?.stageName || feature.properties?.name || `Étape ${defaultIndex + 1}`,
                color: feature.properties?.color || "#3549bb",
                positions: coords,
            });
        }
        if (feature.properties?.coordinateProperties?.times) {
            const coordinateTimes = feature.properties?.coordinateProperties?.times.map((t: string) => new Date(t));
            times.push(...coordinateTimes);
        }
    }

    if (geoJson.type === "FeatureCollection") {
        (geoJson as FeatureCollection).features.forEach((f, idx) => {
            if (f.type === "Feature") {
                processFeature(f, idx);
            }
        });
    } else if (geoJson.type === "Feature") {
        processFeature(geoJson as Feature, 0);
    } else {
        const geom = geoJson as GeometryObject;
        const coords: Position[] = [];
        if (geom.type === "LineString") {
            coords.push(...geom.coordinates);
        } else if (geom.type === "MultiLineString") {
            coords.push(...geom.coordinates.flat());
        }
        if (coords.length > 0) {
            stages.push({
                stageIndex: 0,
                name: "Itinéraire",
                color: "#3549bb",
                positions: coords,
            });
        }
    }

    return { stages, times };
}

/**
 * Event data to `onMove` and `onClick` callback
 */
export type CallbackData = {
    /**
     * The position as `[lon, lat, elevation]`.
     * Elevation will be in meters if the component has been set with the unit "metric" (default)
     * of in feet if the unit is "imperial".
     */
    position: Position;
    /**
     * The distance from the start of the route. In km if the component has been set with the unit "metric" (default)
     * of in miles if the unit is "imperial".
     */
    distance: number;
    /**
     * Cumulated positive elevation from the begining of the route up to this location.
     * In meters if the component has been set with the unit "metric" (default)
     * of in feet if the unit is "imperial".
     */
    dPlus: number;
    /**
     * Slope grade in percentage (1% being a increase of 1m on a 100m distance)
     */
    gradePercent: number;
};

export type ElevationProfileOptions = {
    /**
     * Color of the background of the chart
     */
    backgroundColor?: string | null;
    /**
     * Unit system to use.
     * If "metric", elevation and D+ will be in meters, distances will be in km.
     * If "imperial", elevation and D+ will be in feet, distances will be in miles.
     *
     * Default: "metric"
     */
    unit?: "metric" | "imperial";
    /**
     * Font size applied to axes labels and tooltip.
     *
     * Default: `12`
     */
    fontSize?: number;
    /**
     * If `true`, will force the computation of the elevation of the GeoJSON data provided to the `.setData()` method,
     * even if they already contain elevation (possibly from GPS while recording). If `false`, the elevation will only
     * be computed if missing from the positions.
     *
     * Default: `false`
     */
    forceComputeElevation?: boolean;
    /**
     * Display the elevation label along the vertical axis.
     *
     * Default: `true`
     */
    displayElevationLabels?: boolean;
    /**
     * Display the distance labels alon the horizontal axis.
     *
     * Default: `true`
     */
    displayDistanceLabels?: boolean;
    /**
     * Display the distance and elevation units alongside the labels.
     *
     * Default: `true`
     */
    displayUnits?: boolean;
    /**
     * Color of the elevation and distance labels.
     *
     * Default: `"#0009"` (partially transparent black)
     */
    labelColor?: string;
    /**
     * Color of the elevation profile line.
     * Can be `null` to not display the line and rely on the background color only.
     *
     * Default: `"#66ccff"`
     */
    profileLineColor?: string | null;
    /**
     * Color or tint used to fill the area under the elevation profile line.
     * Default: light subtle tint (rgba(59, 130, 246, 0.22) fading down)
     */
    profileFillColor?: string | null;
    /**
     * Width of the elevation profile line.
     *
     * Default: `1.5`
     */
    profileLineWidth?: number;
    /**
     * Color of the elevation profile background (below the profile line)
     * Can be `null` to not display any backgound color.
     *
     * Default: `"#66ccff22"`
     */
    profileBackgroundColor?: string | null;
    /**
     * Display the tooltip folowing the pointer.
     *
     * Default: `true`
     */
    displayTooltip?: boolean;
    /**
     * Color of the text inside the tooltip.
     *
     * Default: `"#fff"`
     */
    tooltipTextColor?: string;
    /**
     * Color of the tooltip background.
     *
     * Default: `"#000A"` (partially transparent black)
     */
    tooltipBackgroundColor?: string;
    /**
     * Display the distance information inside the tooltip if `true`.
     *
     * Default: `true`
     */
    tooltipDisplayDistance?: boolean;
    /**
     * Display the elevation information inside the tooltip if `true`.
     *
     * Default: `true`
     */
    tooltipDisplayElevation?: boolean;
    /**
     * Display the D+ (cumulated positive ascent) inside the tooltip if `true`.
     *
     * Default: `true`
     */
    tooltipDisplayDPlus?: boolean;
    /**
     * Display the slope grade in percentage inside the tooltip if `true`.
     *
     * Default: `true`
     */
    tooltipDisplayGrade?: boolean;
    /**
    * Display the slope grade in percentage inside the tooltip if `true`.
    *
    * Default: `true`
    */
    tooltipDisplaySpeed?: boolean;
    /**
     * Display the distance grid lines (vertical lines matching the distance labels) if `true`.
     *
     * Default: `false`
     */
    displayDistanceGrid?: boolean;
    /**
     * Display the elevation grid lines (horizontal lines matching the elevation labels) if `true`.
     *
     * Default: `true`
     */
    displayElevationGrid?: boolean;
    /**
     * Color of the distance grid lines.
     *
     * Default: `"#0001"` (partially transparent black)
     */
    distanceGridColor?: string;
    /**
     * Color of the elevation drig lines.
     *
     * Default: `"#0001"` (partially transparent black)
     */
    elevationGridColor?: string;
    /**
     * Padding at the top of the chart, in number of pixels.
     *
     * Default: `30`
     */
    paddingTop?: number;
    /**
     * Padding at the bottom of the chart, in number of pixels.
     *
     * Default: `10`
     */
    paddingBottom?: number;
    /**
     * Padding at the left of the chart, in number of pixels.
     *
     * Default: `10`
     */
    paddingLeft?: number;
    /**
     * Padding at the right of the chart, in number of pixels.
     *
     * Default: `10`
     */
    paddingRight?: number;
    /**
     * Display the crosshair, a vertical line that follows the pointer, if `true`.
     *
     * Default: `true`
     */
    displayCrosshair?: boolean;
    /**
     * Color of the crosshair.
     *
     * Default: `"#0005"` (partially transparent black)
     */
    crosshairColor?: string;
    zoom?: boolean;
    /**
     * Callback function to call when the chart is zoomed or panned.
     * The argument `windowedLineString` is the GeoJSON LineString corresponding
     * to the portion of the route visible in the elevation chart.
     *
     * Default: `null`
     */
    onChangeView?: ((windowedLineString: LineString) => void) | null;
    /**
     * Callback function to call when the the elevation chart is clicked.
     *
     * Default: `null`
     */
    onClick?: ((data: CallbackData) => void) | null;
    /**
     * Callback function to call when the pointer is moving on the elevation chart.
     *
     * Default: `null`
     */
    onMove?: ((data: CallbackData) => void) | null;

    onEnter?: (() => void) | null;

    onLeave?: (() => void) | null;

};

const elevationProfileDefaultOptions: ElevationProfileOptions = {
    backgroundColor: null,
    unit: "metric",
    fontSize: 12,
    forceComputeElevation: false,
    displayElevationLabels: true,
    displayDistanceLabels: true,
    displayUnits: true,
    labelColor: "#0009",
    profileLineColor: null,
    profileLineWidth: 3,
    profileFillColor: "#3549bb",
    displayTooltip: true,
    tooltipTextColor: "#fff",
    tooltipBackgroundColor: "#000A",
    tooltipDisplayDistance: true,
    tooltipDisplayElevation: true,
    tooltipDisplayDPlus: true,
    tooltipDisplayGrade: true,
    tooltipDisplaySpeed: true,
    displayDistanceGrid: false,
    displayElevationGrid: true,
    distanceGridColor: "#0001",
    elevationGridColor: "#0001",
    displayCrosshair: true,
    crosshairColor: "#0005",
    onChangeView: null,
    paddingTop: 30,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 10,
    onClick: null,
    onMove: null,
    zoom: true
};

/**
 * Elevation profile chart
 */
export class ElevationProfile {
    private canvas: HTMLCanvasElement;
    private settings: ElevationProfileOptions;
    public chart: Chart<"line", Array<number>, number>;
    public stages: StageInfo[] = [];
    private pointStageMap: number[] = [];
    private pointStageDistance: number[] = [];
    private elevatedPositions: Position[] = [];
    private elevatedPositionsAdjustedUnit: Position[] = [];
    private cumulatedDistance: number[] = [];
    private cumulatedDistanceAdjustedUnit: number[] = [];
    private cumulatedDPlus: number[] = [];
    private grade: number[] = [];
    private waypointPositions: number[] = []
    private waypoints: Waypoint[] = [];
    private times: Date[] = [];
    private cumulatedTime: number[] = []
    private speed: number[] = [];

    private gradeColor = [
        "#4ade80", // 0: 0% à 2.5% (vert pâle / plat)
        "#22c55e", // 1: 2.5% à 5% (vert)
        "#84cc16", // 2: 5% à 7.5% (vert lime / faux-plat montant)
        "#eab308", // 3: 7.5% à 10% (jaune / côte modérée)
        "#f59e0b", // 4: 10% à 12.5% (jaune ambré)
        "#f97316", // 5: 12.5% à 15% (orange vif / côte raide)
        "#ea580c", // 6: 15% à 17.5% (orange foncé)
        "#ef4444", // 7: 17.5% à 20% (rouge / très raide)
        "#dc2626", // 8: 20% à 22.5% (rouge vif)
        "#b91c1c", // 9: 22.5% à 25% (rouge foncé)
        "#7f1d1d", // 10: 25% à 27.5% (bordeaux foncé)
        "#1c1917", // 11: > 27.5% (noir / mur)
    ];

    private width?: number
    private height?: number
    private gradient?: CanvasGradient;
    private bgGradient?: CanvasGradient;


    constructor(
        /**
         * DIV element to place the chart into
         */
        container: HTMLDivElement | string,
        /**
         * Options
         */
        options: ElevationProfileOptions = {}
    ) {
        const appContainer =
            typeof container === "string"
                ? document.getElementById(container)
                : container;
        if (!appContainer) {
            throw new Error("The container does not exist.");
        }

        this.canvas = document.createElement("canvas");
        this.canvas.id = "elevation-profile-chart"
        appContainer.appendChild(this.canvas);

        Chart.register(...registerables);
        Chart.register(zoomPlugin);

        this.settings = {
            ...elevationProfileDefaultOptions,
            ...options,
        };

        const distanceUnit = this.settings.unit === "imperial" ? "mi" : "km";
        const elevationUnit = this.settings.unit === "imperial" ? "ft" : "m";
        Chart.defaults.font.size = this.settings.fontSize;

        // using CrosshairPlugin normally can lead to race conditions:
        // https://github.com/AbelHeinsbroek/chartjs-plugin-crosshair/issues/119
        const CustomCrosshairPlugin = function (plugin: typeof CrosshairPlugin) {
            const originalAfterDraw = plugin.afterDraw;
            plugin.afterDraw = function (chart: Chart & { crosshair?: typeof CrosshairPlugin }, easing: boolean) {
                if (chart && chart.crosshair) {
                    originalAfterDraw.call(this, chart, easing);
                }
            };
            return plugin;
        };
        Chart.register(CustomCrosshairPlugin(CrosshairPlugin));

        this.chart = new Chart<"line", Array<number>, number>(this.canvas, {
            type: "line",

            data: {
                labels: [],
                datasets: [
                    {
                        label: "Elevation",
                        yAxisID: "y",
                        data: [],
                        pointRadius: 0,
                        fill: "start",
                        borderColor: (context: any) => this.createProfileLineColor(context.chart),
                        backgroundColor: (context: any) => this.createProfileFillColor(context.chart),
                        tension: 0.1,
                        spanGaps: true,
                        borderWidth: this.settings.profileLineWidth ?? 2.5,
                    }
                ],
            },

            options: {
                layout: {
                    padding: {
                        left: this.settings.paddingLeft,
                        right: this.settings.paddingRight,
                        bottom: this.settings.paddingBottom,
                        top: this.settings.paddingTop ?? 16,
                    },
                },
                onClick: (_e, item) => {
                    if (typeof this.settings.onClick !== "function") return;

                    try {
                        const i = item[0].index;

                        this.settings.onClick.apply(this, [
                            {
                                position: this.elevatedPositionsAdjustedUnit[i],
                                distance: this.pointStageDistance[i] ?? this.cumulatedDistanceAdjustedUnit[i],
                                dPlus: this.cumulatedDPlus[i],
                                gradePercent: this.grade[i],
                            },
                        ]);
                    } catch (e) {
                        // Nothing to do
                    }
                },
                onHover: (_e, item) => {
                    if (typeof this.settings.onMove !== "function") return;
                    try {
                        const i = item[0].index;

                        this.settings.onMove.apply(this, [
                            {
                                position: this.elevatedPositionsAdjustedUnit[i],
                                distance: this.pointStageDistance[i] ?? this.cumulatedDistanceAdjustedUnit[i],
                                dPlus: this.cumulatedDPlus[i],
                                gradePercent: this.grade[i],
                            },
                        ]);
                    } catch (e) {
                        // Nothing to do
                    }
                },
                animation: false,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        min: 0,
                        max: 0,
                        type: "linear",
                        grid: {
                            display: this.settings.displayDistanceGrid,
                            drawOnChartArea: false,
                            color: this.settings.distanceGridColor,
                            drawTicks: true,
                            tickLength: 5,
                            tickColor: "#0002"
                        },
                        afterBuildTicks: (scale) => {
                            if (!this.stages || this.stages.length <= 1) return;

                            const ticks: { value: number }[] = [];
                            for (const stage of this.stages) {
                                const len = stage.totalDistance;
                                let step = 5;
                                if (len <= 4) step = 1;
                                else if (len <= 10) step = 2;
                                else if (len <= 25) step = 5;
                                else if (len <= 60) step = 10;
                                else step = 20;

                                // Stage start tick (0 km)
                                ticks.push({ value: stage.startDistance });

                                // Intermediate ticks inside this stage
                                for (let d = step; d < len - step * 0.35; d += step) {
                                    ticks.push({ value: stage.startDistance + d });
                                }
                            }
                            scale.ticks = ticks;
                        },
                        ticks: {
                            stepSize: 0.1,
                            align: "inner",
                            display: this.settings.displayDistanceLabels,
                            color: this.settings.labelColor,
                            maxRotation: 0,
                            callback: (value, index) => {
                                const numVal = Number(value);
                                if (this.stages && this.stages.length > 1) {
                                    const stage = this.stages.find(
                                        (s) => numVal >= s.startDistance - 0.02 && numVal <= s.endDistance + 0.02
                                    );
                                    if (stage) {
                                        const relDist = numVal - stage.startDistance;
                                        if (relDist < 0.05) {
                                            return `0 ${distanceUnit}`;
                                        }
                                        const rounded = Math.round(relDist * 10) / 10;
                                        return `${rounded} ${distanceUnit}`;
                                    }
                                }

                                if (index % 10 !== 0) {
                                    return "";
                                }
                                const roundedValue = ~~((numVal as number) * 100) / 100;
                                return this.settings.displayUnits
                                    ? `${roundedValue} ${distanceUnit}`
                                    : roundedValue;
                            },
                        },
                    },
                    y: {
                        min: 0,
                        max: 0,
                        type: "linear",
                        afterTickToLabelConversion: (scaleInstance) => {
                            scaleInstance.ticks.pop();
                            scaleInstance.ticks.shift();
                        },
                        ticks: {
                            mirror: true,
                            maxTicksLimit: 10,
                            align: "end",
                            display: this.settings.displayElevationLabels,
                            color: this.settings.labelColor,

                            callback: (value) => {
                                const roundedValue = ~~((value as number) * 100) / 100;
                                return this.settings.displayUnits
                                    ? `${roundedValue} ${elevationUnit}`
                                    : roundedValue;
                            },
                        },
                        border: {
                            dash: [5, 5],
                            display: true,
                            color: this.settings.elevationGridColor,
                        },
                        grid: {
                            display: this.settings.displayElevationGrid,
                            color: this.settings.elevationGridColor,
                            drawTicks: false,
                        },
                    },
                },

                interaction: {
                    intersect: false,
                    mode: "index",
                },

                plugins: {
                    zoom: {
                        zoom: {
                            wheel: {
                                enabled: this.settings.zoom,
                            },
                            pinch: {
                                enabled: this.settings.zoom,
                            },
                            mode: "x",
                        },
                        pan: {
                            enabled: this.settings.zoom,
                            mode: "x",
                        },
                        limits: {
                            x: {
                                min: "original",
                                max: "original",
                            },
                        },
                    },
                    title: {
                        display: false,
                    },
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        enabled: this.settings.displayTooltip,
                        yAlign: "center",
                        cornerRadius: 4,
                        displayColors: false,
                        backgroundColor: this.settings.tooltipBackgroundColor,
                        bodyColor: this.settings.tooltipTextColor,
                        callbacks: {
                            title: () => {
                                return "";
                            },

                            label: (tooltipItem) => {
                                if (tooltipItem.datasetIndex != 0) {
                                    return "";
                                }
                                const idx = tooltipItem.dataIndex;
                                const stageIdx = this.pointStageMap[idx] ?? 0;
                                const stage = this.stages[stageIdx];
                                const stageDist = this.pointStageDistance[idx] ?? this.cumulatedDistanceAdjustedUnit[idx];

                                const tooltipInfo: string[] = [];
                                if (stage && this.stages.length > 1) {
                                    tooltipInfo.push(`${stage.name}`);
                                }

                                if (this.settings.tooltipDisplayDistance) {
                                    if (stage && this.stages.length > 1) {
                                        tooltipInfo.push(
                                            `Distance : ${stageDist.toFixed(2)} ${distanceUnit} / ${stage.totalDistance.toFixed(1)} ${distanceUnit}`
                                        );
                                    } else {
                                        tooltipInfo.push(
                                            `Distance : ${stageDist.toFixed(2)} ${distanceUnit} ${this.cumulatedTime.length ? '(' + formatTimeHHMM(this.cumulatedTime[idx]) + ')' : ''}`
                                        );
                                    }
                                }

                                if (this.settings.tooltipDisplayElevation) {
                                    tooltipInfo.push(
                                        `Altitude : ${this.elevatedPositionsAdjustedUnit[
                                            idx
                                        ][2].toFixed(0)} ${elevationUnit}`
                                    );
                                }

                                if (this.settings.tooltipDisplayDPlus) {
                                    tooltipInfo.push(
                                        `D+ : ${this.cumulatedDPlus[idx].toFixed(
                                            0
                                        )} ${elevationUnit}`
                                    );
                                }

                                if (this.settings.tooltipDisplayGrade) {
                                    tooltipInfo.push(
                                        `Pente : ${this.grade[idx].toFixed(1)}%`
                                    );
                                }

                                if (this.settings.tooltipDisplaySpeed && this.speed.length) {
                                    tooltipInfo.push(`Vitesse : ${this.speed[
                                        idx
                                    ]?.toFixed(2)} ${distanceUnit}/h`
                                    );
                                }

                                return tooltipInfo;
                            },
                        },
                    },

                    // The crosshair plugin does not have types
                    // @ts-ignore
                    crosshair: {
                        zoom: {
                            enabled: false,
                        },
                        line: {
                            color: this.settings.displayCrosshair
                                ? this.settings.crosshairColor
                                : "#0000",
                            width: 1,
                        },
                    },
                },
            },

            plugins: [
                {
                    id: "stageSeparatorPlugin",
                    afterDraw: (chart) => {
                        if (!this.stages || this.stages.length <= 1) return;
                        const ctx = chart.ctx;
                        const chartArea = chart.chartArea;
                        const xScale = chart.scales.x;
                        if (!ctx || !chartArea || !xScale) return;

                        ctx.save();

                        this.stages.forEach((stage, idx) => {
                            const xStart = xScale.getPixelForValue(stage.startDistance);
                            const xEnd = xScale.getPixelForValue(stage.endDistance);

                            // Draw vertical separator at stage boundary
                            if (idx > 0) {
                                ctx.beginPath();
                                ctx.setLineDash([4, 4]);
                                ctx.strokeStyle = this.settings.labelColor
                                    ? this.colorWithAlpha(this.settings.labelColor, 0.25)
                                    : "rgba(100, 116, 139, 0.3)";
                                ctx.lineWidth = 1.5;
                                ctx.moveTo(xStart, chartArea.top);
                                ctx.lineTo(xStart, chartArea.bottom);
                                ctx.stroke();
                                ctx.setLineDash([]);
                            }
                        });

                        ctx.restore();
                    },
                },
                {
                    id: "waypointPlugin",
                    afterDraw: (chart, args, options) => {
                        const waypointContainer = document.getElementById("waypoint-container") as HTMLDivElement;
                        waypointContainer.innerHTML = ""; // Clear previous ticks

                        const xScale = chart.scales.x; // Get X-axis scale
                        const chartRect = chart.canvas.getBoundingClientRect(); // Canvas position

                        this.waypointPositions.forEach((position: number, index: number) => {

                            const xPos = xScale.getPixelForValue(position); // X-axis pixel for tick

                            // Create custom HTML tick
                            const wpDiv = document.createElement("div");
                            wpDiv.className = "wp-marker absolute -translate-x-1/2 w-6 aspect-square bg-background-inverse rounded-full flex justify-center items-center text-content-inverse cursor-pointer hover:scale-110";
                            wpDiv.style.left = `${xPos}px`; // Position horizontally
                            wpDiv.style.top = `8px`; // Position horizontally

                            // Add custom HTML content (e.g., icon + label)
                            const tooltipDiv = document.createElement("div");
                            tooltipDiv.className = "tooltip";
                            tooltipDiv.dataset.title = this.waypoints[index]?.name ?? "?";
                            const iconEl = document.createElement("i");
                            const safeIcon = this.waypoints.at(index)?.icon ?? "circle";
                            iconEl.className = `fa fa-${/^[a-z0-9-]+$/.test(safeIcon) ? safeIcon : "circle"}`;
                            tooltipDiv.appendChild(iconEl);
                            wpDiv.appendChild(tooltipDiv);

                            waypointContainer.appendChild(wpDiv); // Add to container
                        });
                    }
                },
                {
                    id: "customZoomEvent",
                    afterDataLimits: (chart) => {
                        if (typeof this.settings.onChangeView !== "function") return;
                        try {
                            this.settings.onChangeView.apply(this, [
                                this.createWindowExtractLineString(),
                            ]);
                        } catch (e) {
                            // nothing to do
                        }
                    },
                },
            ],
        });
        if (typeof this.settings.onLeave === "function") {
            this.chart.canvas.addEventListener("mouseout", this.settings.onLeave)
        }

        if (typeof this.settings.onEnter === "function") {
            this.chart.canvas.addEventListener("mouseenter", this.settings.onEnter)
        }

        // If the tooltip is shown, then we hide it when panning the chart
        if (this.settings.displayTooltip) {
            let mouseDown = false;
            this.chart.canvas.addEventListener("mousedown", () => {
                mouseDown = true;
            });

            this.chart.canvas.addEventListener("mousemove", () => {
                if (
                    mouseDown &&
                    this.chart.options.plugins &&
                    this.chart.options.plugins.tooltip
                ) {
                    this.chart.options.plugins.tooltip.enabled = false;
                    this.chart.update();
                }
            });

            window.addEventListener("mouseup", () => {
                if (this.chart.options.plugins && this.chart.options.plugins.tooltip) {
                    this.chart.options.plugins.tooltip.enabled = true;
                    this.chart.update();
                    mouseDown = false;
                }
            });
        }
    }

    getChartCoordinatesFromPosition(lat: number, lon: number) {

        let minDistance = Infinity
        let bestCandiateIndex: number = -1
        for (let i = 0; i < this.elevatedPositionsAdjustedUnit.length; i++) {
            const p = this.elevatedPositionsAdjustedUnit[i];
            const deltaLat = lat - p[1];
            const deltaLon = lon - p[0];
            const distance = deltaLat * deltaLat + deltaLon * deltaLon;

            if (distance < minDistance) {
                minDistance = distance;
                bestCandiateIndex = i
            }
        };

        if (bestCandiateIndex < 0) {
            return null;
        }
        const meta = this.chart.getDatasetMeta(0);
        const element = meta.data[bestCandiateIndex];
        if (element) {
            return [element.x, element.y];
        }
        return null;
    }

    gradientFromElevation(chart: Chart, force: boolean = false, alpha?: string) {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;

        if (!chartArea) {
            return;
        }

        const chartWidth = chartArea.right - chartArea.left;
        const chartHeight = chartArea.bottom - chartArea.top;

        if (chartWidth == 0 || chartHeight == 0) {
            return;
        }

        if (alpha) {
            if (!this.bgGradient || this.width !== chartWidth || this.height !== chartHeight || force) {
                this.bgGradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0) as CanvasGradient;

                const firstColor = this.gradeColor[0].length === 7 ? this.gradeColor[0] + alpha : this.gradeColor[0];
                this.bgGradient.addColorStop(0, firstColor);

                let prevColor = this.gradeColor[0];
                for (let i = 0; i < this.grade.length; i++) {
                    const grade = ~~(Math.abs(this.grade[i]) / 2.5);

                    let color;
                    if (grade < 1) {
                        color = this.gradeColor[0];
                    } else if (grade > 10) {
                        color = this.gradeColor[11];
                    } else {
                        color = this.gradeColor[grade];
                    }

                    if (color !== prevColor) {
                        const percentDone = this.cumulatedDistance[i] / this.cumulatedDistance[this.cumulatedDistance.length - 1];
                        const stopColor = color.length === 7 ? color + alpha : color;
                        this.bgGradient.addColorStop(percentDone, stopColor);

                        prevColor = color;
                    }
                }
            }
            return this.bgGradient;
        }

        if (!this.gradient || this.width !== chartWidth || this.height !== chartHeight || force) {
            this.width = chartWidth;
            this.height = chartHeight;

            this.gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0) as CanvasGradient;

            this.gradient.addColorStop(0, this.gradeColor[0]);

            const maxDist = this.cumulatedDistance.at(-1) || 1;
            let prevColor = this.gradeColor[0];
            let lastOffset = 0;

            for (let i = 0; i < this.grade.length; i++) {
                const grade = ~~(Math.abs(this.grade[i]) / 2.5);

                let color;
                if (grade < 1) {
                    color = this.gradeColor[0];
                } else if (grade > 10) {
                    color = this.gradeColor[11];
                } else {
                    color = this.gradeColor[grade];
                }

                if (color !== prevColor) {
                    const percentDone = Math.max(lastOffset, Math.min(1, this.cumulatedDistance[i] / maxDist));
                    if (percentDone >= lastOffset) {
                        this.gradient.addColorStop(percentDone, color);
                        lastOffset = percentDone;
                    }
                    prevColor = color;
                }
            }
        }
        return this.gradient;
    }

    createWindowExtractLineString(): LineString {
        const scaleMin = this.chart.scales.x.min;
        const scaleMax = this.chart.scales.x.max;

        const cda = this.cumulatedDistanceAdjustedUnit;
        const nbElem = cda.length;

        let indexStart = 0;
        let indexEnd = nbElem - 1;

        // find the start index
        for (let i = 0; i < nbElem; i += 1) {
            if (cda[i] >= scaleMin) {
                indexStart = i;
                break;
            }
        }

        // find the end index
        for (let i = nbElem - 1; i >= indexStart; i -= 1) {
            if (cda[i] <= scaleMax) {
                indexEnd = i;
                break;
            }
        }

        return this.createExtractLineString(indexStart, indexEnd);
    }

    createExtractLineString(fromIndex: number, toIndex: number): LineString {
        const elevatedPositionsWindow: Position[] = this.elevatedPositions.slice(
            fromIndex,
            toIndex
        );

        return {
            type: "LineString",
            coordinates: elevatedPositionsWindow,
        };
    }

    private colorWithAlpha(color: string, alpha: number): string {
        if (!color) return `rgba(53, 73, 187, ${alpha})`;
        if (color.startsWith("#")) {
            let hex = color.slice(1);
            if (hex.length === 8) {
                hex = hex.slice(0, 6);
            }
            if (hex.length === 3) {
                hex = hex.split("").map((c) => c + c).join("");
            }
            if (hex.length === 6) {
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
        } else if (color.startsWith("rgb")) {
            const matches = color.match(/\d+/g);
            if (matches && matches.length >= 3) {
                return `rgba(${matches[0]}, ${matches[1]}, ${matches[2]}, ${alpha})`;
            }
        }
        return color;
    }

    createProfileLineColor(chart: Chart): CanvasGradient | string {
        if (this.settings.profileLineColor) {
            return this.settings.profileLineColor;
        }
        return this.gradientFromElevation(chart, true) || this.gradeColor[0];
    }

    createProfileFillColor(chart: Chart): CanvasGradient | string {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;

        const defaultFill = this.settings.profileFillColor;
        if (!this.stages || this.stages.length <= 1) {
            const color = defaultFill || this.stages?.[0]?.color || "#3549bb";
            return this.colorWithAlpha(color, 0.12);
        }

        if (!ctx || !chartArea || chartArea.right <= chartArea.left) {
            return this.colorWithAlpha(this.stages[0]?.color ?? "#3549bb", 0.12);
        }

        const totalDist = this.cumulatedDistanceAdjustedUnit.at(-1) || 1;
        const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);

        for (let s = 0; s < this.stages.length; s++) {
            const stage = this.stages[s];
            const p1 = Math.max(0, Math.min(1, stage.startDistance / totalDist));
            const p2 = Math.max(0, Math.min(1, stage.endDistance / totalDist));
            const flatTint = this.colorWithAlpha(stage.color, 0.12);
            gradient.addColorStop(p1, flatTint);
            gradient.addColorStop(p2, flatTint);
        }

        return gradient;
    }

    fillGradient(chart: Chart): CanvasGradient | string {
        return this.createProfileFillColor(chart);
    }

    toggleTheme(options: ElevationProfileOptions) {
        this.settings = {
            ...this.settings,
            ...options,
        };
        this.chart.data.datasets[0].backgroundColor = (context: any) => this.createProfileFillColor(context.chart);
        this.chart.data.datasets[0].borderColor = (context: any) => this.createProfileLineColor(context.chart);
        this.chart.options.scales!.x!.ticks!.color = this.settings.labelColor;

        this.chart.options.scales!.y!.grid!.color = this.settings.elevationGridColor;
        this.chart.options.scales!.y!.border!.color = this.settings.elevationGridColor;
        this.chart.options.scales!.y!.ticks!.color = this.settings.labelColor;

        (this.chart.options.plugins as any).crosshair!.line.color = this.settings.crosshairColor;

        this.chart.update();
    }

    setProfileLineColor(color: string | null) {
        this.settings.profileLineColor = color;
        if (this.chart?.data?.datasets?.[0]) {
            this.chart.data.datasets[0].borderColor = (context: any) => this.createProfileLineColor(context.chart);
            this.chart.update();
        }
    }

    setProfileFillColor(color: string | null) {
        this.settings.profileFillColor = color;
        if (this.chart?.data?.datasets?.[0]) {
            this.chart.data.datasets[0].backgroundColor = (context: any) => this.createProfileFillColor(context.chart);
            this.chart.update();
        }
    }

    async setData(data: GeoJsonObject, waypoints?: Waypoint[]) {
        const { stages: rawStages, times } = extractStagesAndPositions(data);
        this.times = times;
        this.waypoints = waypoints ?? [];
        this.waypointPositions = [];

        this.stages = [];
        this.pointStageMap = [];
        this.pointStageDistance = [];

        const isImperial = this.settings.unit === "imperial";
        const distConversion = isImperial ? MILES_PER_METER : 0.001;
        const eleConversion = isImperial ? FEET_PER_METER : 1;

        const allElevatedPositions: Position[] = [];
        const allCumulatedDistances: number[] = [];
        let currentGlobalDist = 0;

        for (let sIdx = 0; sIdx < rawStages.length; sIdx++) {
            const rawStage = rawStages[sIdx];
            if (rawStage.positions.length === 0) continue;

            const smoothed = smoothElevations(
                rawStage.positions,
                Math.max(1, Math.ceil(rawStage.positions.length / 100))
            );

            const stageDistancesMeters = smoothed.length >= 2
                ? haversineCumulatedDistanceWgs84(smoothed)
                : [0];

            const stageStartIndex = allElevatedPositions.length;
            const stageStartDistAdjusted = currentGlobalDist * distConversion;

            for (let pIdx = 0; pIdx < smoothed.length; pIdx++) {
                const pos = smoothed[pIdx];
                const distInStageMeters = stageDistancesMeters[pIdx] || 0;
                const globalDistMeters = currentGlobalDist + distInStageMeters;

                allElevatedPositions.push(pos);
                allCumulatedDistances.push(globalDistMeters);

                const pointIndex = allElevatedPositions.length - 1;
                this.pointStageMap[pointIndex] = sIdx;
                this.pointStageDistance[pointIndex] = distInStageMeters * distConversion;
            }

            const stageEndIndex = allElevatedPositions.length - 1;
            const stageTotalDistMeters = stageDistancesMeters.at(-1) || 0;
            currentGlobalDist += stageTotalDistMeters;
            const stageEndDistAdjusted = currentGlobalDist * distConversion;

            this.stages.push({
                stageIndex: rawStage.stageIndex,
                name: rawStage.name,
                color: rawStage.color,
                startIndex: stageStartIndex,
                endIndex: stageEndIndex,
                startDistance: stageStartDistAdjusted,
                endDistance: stageEndDistAdjusted,
                totalDistance: stageEndDistAdjusted - stageStartDistAdjusted,
            });
        }

        this.elevatedPositions = allElevatedPositions;
        this.cumulatedDistance = allCumulatedDistances;
        this.cumulatedDistanceAdjustedUnit = allCumulatedDistances.map((d) => d * distConversion);
        this.elevatedPositionsAdjustedUnit = allElevatedPositions.map((pos) => [
            pos[0],
            pos[1],
            pos[2] * eleConversion,
        ]);

        this.cumulatedDPlus = [];
        this.grade = [];
        this.cumulatedTime = [];
        this.speed = [];

        let cumulatedDPlus = 0;
        let cumulatedTime = 0;

        const minSegmentDistance = (this.cumulatedDistance.at(-1) ?? 1000) / 100;
        let segmentStartIndex = 0;

        const minDistances = new Array(this.waypoints.length).fill(Infinity);

        for (let i = 0; i < this.elevatedPositions.length; i++) {
            // Check waypoint proximity
            this.waypoints.forEach((waypoint, waypointIndex) => {
                const distance = haversineDistance(
                    this.elevatedPositions[i][1],
                    this.elevatedPositions[i][0],
                    waypoint.lat,
                    waypoint.lon
                );
                if (distance < minDistances[waypointIndex]) {
                    minDistances[waypointIndex] = distance;
                    this.waypointPositions[waypointIndex] = this.cumulatedDistanceAdjustedUnit[i];
                    waypoint.distance_from_start = this.cumulatedDistanceAdjustedUnit[i] * 1000;
                }
            });

            const elevation = this.elevatedPositions[i][2];
            const time = this.times[i];
            if (i > 0) {
                const elevationPrevious = this.elevatedPositions[i - 1][2];
                const elevationDelta = elevation - elevationPrevious;
                const segmentDistance =
                    this.cumulatedDistance[i] - this.cumulatedDistance[segmentStartIndex];
                cumulatedDPlus += Math.max(0, elevationDelta);
                this.cumulatedDPlus.push(cumulatedDPlus * eleConversion);

                if (time && this.times[i - 1]) {
                    const timePrevious = this.times[i - 1];
                    const timeDelta = (time.getTime() - timePrevious.getTime()) / 1000;
                    cumulatedTime += timeDelta;
                    this.cumulatedTime.push(cumulatedTime);
                }

                if (segmentDistance >= minSegmentDistance || i === this.elevatedPositions.length - 1) {
                    const elevationStart = this.elevatedPositions[segmentStartIndex][2];
                    const elevationEnd = this.elevatedPositions[i][2];
                    const elevationDelta = elevationEnd - elevationStart;
                    const gradePercent = segmentDistance > 0 ? (elevationDelta / segmentDistance) * 100 : 0;

                    let speed;
                    if (this.times.length) {
                        const distanceStart = this.cumulatedDistance[segmentStartIndex];
                        const distanceEnd = this.cumulatedDistance[i];
                        const distanceDelta = distanceEnd - distanceStart;
                        const timeStart = this.times[segmentStartIndex];
                        const timeEnd = this.times[i];
                        if (timeStart && timeEnd) {
                            const timeDelta = (timeEnd.getTime() - timeStart.getTime()) / 1000;
                            if (timeDelta > 0) {
                                speed = distanceDelta / timeDelta;
                                speed = isImperial
                                    ? speed * MILES_HOUR_PER_METER_SECOND
                                    : speed * KILOMETERS_HOUR_PER_METER_SECOND;
                            }
                        }
                    }

                    for (let j = segmentStartIndex; j <= i; j++) {
                        this.grade.push(gradePercent);
                        if (speed !== undefined) {
                            this.speed.push(speed);
                        }
                    }
                    segmentStartIndex = i + 1;
                }
            } else {
                this.cumulatedDPlus.push(0);
            }
        }

        this.grade.push(this.grade.at(-1) ?? 0);

        let minElevation = +Infinity;
        let maxElevation = -Infinity;

        for (let i = 0; i < this.elevatedPositionsAdjustedUnit.length; i += 1) {
            if (this.elevatedPositionsAdjustedUnit[i][2] < minElevation) {
                minElevation = this.elevatedPositionsAdjustedUnit[i][2];
            }
            if (this.elevatedPositionsAdjustedUnit[i][2] > maxElevation) {
                maxElevation = this.elevatedPositionsAdjustedUnit[i][2];
            }
        }

        const elevationPadding = (maxElevation - minElevation) * 0.1 || 10;
        this.chart.data.labels = this.cumulatedDistanceAdjustedUnit;
        this.chart.data.datasets[0].data = this.elevatedPositionsAdjustedUnit.map((pos) => pos[2]);

        this.chart.data.datasets[0].borderColor = (context: any) => this.createProfileLineColor(context.chart);
        this.chart.data.datasets[0].backgroundColor = (context: any) => this.createProfileFillColor(context.chart);

        if (this.chart.options.scales && this.chart.options.scales.x && this.chart.options.scales.y) {
            this.chart.options.scales.x.min = this.cumulatedDistanceAdjustedUnit[0] || 0;
            this.chart.options.scales.x.max =
                this.cumulatedDistanceAdjustedUnit[this.cumulatedDistanceAdjustedUnit.length - 1] || 0;

            this.chart.options.scales.y.min = minElevation - elevationPadding;
            this.chart.options.scales.y.max = maxElevation + elevationPadding;
        }
        this.chart.update();
    }

}