import * as M from "maplibre-gl";
import { type ControlPosition, type IControl } from "maplibre-gl";

export class FullscreenControl implements IControl {
    private buttonContainer?: HTMLDivElement;
    private fullscreenButton?: HTMLButtonElement;
    private iconSpan?: HTMLSpanElement;

    private callback: (e: MouseEvent) => void;

    constructor(callback: (e: MouseEvent) => void) {
        this.callback = callback;

    }


    onAdd(map: M.Map): HTMLElement {
        this.buttonContainer = document.createElement("div");

        this.buttonContainer.classList.add(
            "maplibregl-ctrl",
            "maplibregl-ctrl-group"
        );
        this.fullscreenButton = document.createElement("button");
        this.fullscreenButton.type = "button";
        this.fullscreenButton.title = "Plein écran";
        this.fullscreenButton.setAttribute("aria-label", "Plein écran");
        this.buttonContainer.appendChild(this.fullscreenButton);
        this.iconSpan = document.createElement("i");
        this.iconSpan.classList.add("fa-solid", "fa-expand", "text-neutral-800", "dark:text-neutral-200");
        this.fullscreenButton.appendChild(this.iconSpan);
        this.fullscreenButton.addEventListener("click", this.callback);

        return this.buttonContainer;
    }

    onRemove(): void {
        // remove button
        if (this.buttonContainer?.parentNode) {
            this.buttonContainer.parentNode.removeChild(this.buttonContainer);
        }
        this.buttonContainer = undefined;
        this.fullscreenButton = undefined;
    }
}