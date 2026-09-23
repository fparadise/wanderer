import { describe, expect, it } from "vitest";
import { getFileURL, isURL, isVideoURL } from "./file_util";

describe("file_util", () => {
    describe("getFileURL", () => {
        const dummyRecord = {
            collectionId: "e864strfxo14pm4",
            id: "253ac8164a00ad3",
        };

        it("returns empty string when filename is empty", () => {
            expect(getFileURL(dummyRecord, "")).toBe("");
            expect(getFileURL(dummyRecord, undefined)).toBe("");
        });

        it("returns full external URL as is", () => {
            expect(getFileURL(dummyRecord, "https://example.com/photo.jpg")).toBe(
                "https://example.com/photo.jpg",
            );
        });

        it("constructs PocketBase file URL without thumb", () => {
            expect(getFileURL(dummyRecord, "photo.jpg")).toBe(
                "/api/v1/files/e864strfxo14pm4/253ac8164a00ad3/photo.jpg",
            );
        });

        it("appends thumb query parameter when provided", () => {
            expect(getFileURL(dummyRecord, "photo.jpg", "600x0")).toBe(
                "/api/v1/files/e864strfxo14pm4/253ac8164a00ad3/photo.jpg?thumb=600x0",
            );
            expect(getFileURL(dummyRecord, "avatar.png", "100x100")).toBe(
                "/api/v1/files/e864strfxo14pm4/253ac8164a00ad3/avatar.png?thumb=100x100",
            );
        });

        it("does not append thumb query parameter for video files", () => {
            expect(getFileURL(dummyRecord, "video.mp4", "600x0")).toBe(
                "/api/v1/files/e864strfxo14pm4/253ac8164a00ad3/video.mp4",
            );
        });
    });

    describe("isURL", () => {
        it("identifies valid http/https URLs", () => {
            expect(isURL("http://example.com")).toBe(true);
            expect(isURL("https://example.com/img.png")).toBe(true);
            expect(isURL("img.png")).toBe(false);
            expect(isURL("/local/path.jpg")).toBe(false);
        });
    });

    describe("isVideoURL", () => {
        it("identifies video extensions and data URIs", () => {
            expect(isVideoURL("trail_video.mp4")).toBe(true);
            expect(isVideoURL("clip.webm")).toBe(true);
            expect(isVideoURL("photo.jpg")).toBe(false);
            expect(isVideoURL("data:video/mp4;base64,...")).toBe(true);
            expect(isVideoURL("data:image/png;base64,...")).toBe(false);
        });
    });
});
