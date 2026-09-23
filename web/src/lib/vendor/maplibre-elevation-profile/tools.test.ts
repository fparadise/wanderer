import { describe, expect, it } from 'vitest';
import { haversineCumulatedDistanceWgs84, smoothElevations } from './tools';
import type { Position } from 'geojson';

describe('tools', () => {
    describe('haversineCumulatedDistanceWgs84', () => {
        it('returns empty array when path has less than 2 coordinates', () => {
            expect(haversineCumulatedDistanceWgs84([])).toEqual([]);
            expect(haversineCumulatedDistanceWgs84([[0, 0]])).toEqual([]);
        });

        it('calculates cumulated distance correctly', () => {
            const path: Position[] = [
                [2.3522, 48.8566],
                [2.3522, 48.8666],
            ];
            const distances = haversineCumulatedDistanceWgs84(path);
            expect(distances).toHaveLength(2);
            expect(distances[0]).toBe(0);
            expect(distances[1]).toBeGreaterThan(1000);
            expect(distances[1]).toBeLessThan(1200);
        });
    });

    describe('smoothElevations', () => {
        it('returns positions unchanged when windowSize < 1', () => {
            const positions: Position[] = [[0, 0, 100], [0, 1, 200]];
            expect(smoothElevations(positions, 0)).toEqual(positions);
            expect(smoothElevations(positions, -1)).toEqual(positions);
        });

        it('handles empty array', () => {
            expect(smoothElevations([], 5)).toEqual([]);
        });

        it('handles single position', () => {
            const single: Position[] = [[2.35, 48.85, 150]];
            const res = smoothElevations(single, 5);
            expect(res).toHaveLength(1);
            expect(res[0][0]).toBe(2.35);
            expect(res[0][1]).toBe(48.85);
            expect(res[0][2]).toBe(150);
        });

        it('keeps constant elevations identical', () => {
            const constant: Position[] = [
                [0, 0, 100],
                [1, 1, 100],
                [2, 2, 100],
                [3, 3, 100],
                [4, 4, 100],
            ];
            const smoothed = smoothElevations(constant, 3);
            for (let i = 0; i < constant.length; i++) {
                expect(smoothed[i][2]).toBeCloseTo(100, 5);
            }
        });

        it('correctly calculates weighted moving average', () => {
            // Test 3 points with windowSize = 3 (half = 1)
            // Points: [0, 0, 10], [0, 1, 20], [0, 2, 30]
            // For i = 1: start = 0, end = 3
            // weights: 1, 2, 3 -> sum of weights = 6
            // weighted sum: 10 * 1 + 20 * 2 + 30 * 3 = 10 + 40 + 90 = 140
            // smoothed elevation = 140 / 6 = 23.3333...
            const points: Position[] = [
                [0, 0, 10],
                [0, 1, 20],
                [0, 2, 30],
            ];
            const smoothed = smoothElevations(points, 3);
            expect(smoothed[1][2]).toBeCloseTo(140 / 6, 5);

            // For i = 0: start = 0, end = 2
            // weights: 1, 2 -> sum = 3
            // weighted sum: 10 * 1 + 20 * 2 = 50 -> 50 / 3 = 16.666...
            expect(smoothed[0][2]).toBeCloseTo(50 / 3, 5);

            // For i = 2: start = 1, end = 3
            // weights: 1, 2 -> sum = 3
            // weighted sum: 20 * 1 + 30 * 2 = 80 -> 80 / 3 = 26.666...
            expect(smoothed[2][2]).toBeCloseTo(80 / 3, 5);
        });
    });
});
