<script lang="ts">
    import { Editor, mergeAttributes, Node } from "@tiptap/core";
    import { NodeSelection } from "@tiptap/pm/state";
    import { Link } from "@tiptap/extension-link";
    import Mention from "@tiptap/extension-mention";
    import Placeholder from "@tiptap/extension-placeholder";
    import StarterKit from "@tiptap/starter-kit";
    import { mount, onDestroy, onMount, unmount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { z, ZodError } from "zod";
    import { type DropdownItem } from "./dropdown.svelte";
    import Modal from "./modal.svelte";
    import {
        default as DropdownList,
        default as SearchList,
    } from "./search_list.svelte";
    import Select, { type SelectItem } from "./select.svelte";
    import type { Level } from "@tiptap/extension-heading";
    import TextField from "./text_field.svelte";
    import Toggle from "./toggle.svelte";
    import type { SearchItem } from "./search.svelte";
    import type { SuggestionProps } from "@tiptap/suggestion";
    import type { Actor, ActorSearchResult } from "$lib/models/activitypub/actor";
    import type { ArticleMediaItem } from "$lib/models/article_media";
    import type { Trail } from "$lib/models/trail";
    import { TRAIL_COLORS } from "$lib/config/map";
    import { searchActors } from "$lib/stores/search_store";
    import { show_toast } from "$lib/stores/toast_store.svelte";
    import { isVideoURL } from "$lib/util/file_util";

    export const CustomImage = Node.create({
        name: "image",
        group: "block",
        selectable: true,
        draggable: true,
        addAttributes() {
            return {
                src: { default: null },
                alt: { default: "" },
                title: { default: "" },
                layout: {
                    default: "full",
                    parseHTML: (element) => element.getAttribute("data-layout") || "full",
                    renderHTML: (attributes) => ({
                        "data-layout": attributes.layout || "full",
                    }),
                },
            };
        },
        parseHTML() {
            return [
                {
                    tag: "figure[data-layout]",
                    getAttrs: (dom) => {
                        const el = dom as HTMLElement;
                        const media = el.querySelector("img, video");
                        const figcaption = el.querySelector("figcaption");
                        return {
                            src: media?.getAttribute("src") || null,
                            alt: media?.getAttribute("alt") || "",
                            title: figcaption?.textContent?.trim() || media?.getAttribute("title") || "",
                            layout: el.getAttribute("data-layout") || "full",
                        };
                    },
                },
                {
                    tag: "figure",
                    getAttrs: (dom) => {
                        const el = dom as HTMLElement;
                        const media = el.querySelector("img, video");
                        const figcaption = el.querySelector("figcaption");
                        return {
                            src: media?.getAttribute("src") || null,
                            alt: media?.getAttribute("alt") || "",
                            title: figcaption?.textContent?.trim() || media?.getAttribute("title") || "",
                            layout: "full",
                        };
                    },
                },
                {
                    tag: "img[src]",
                    getAttrs: (dom) => {
                        const el = dom as HTMLElement;
                        return {
                            src: el.getAttribute("src"),
                            alt: el.getAttribute("alt") || "",
                            title: el.getAttribute("title") || "",
                            layout: "full",
                        };
                    },
                },
                {
                    tag: "video[src]",
                    getAttrs: (dom) => {
                        const el = dom as HTMLElement;
                        return {
                            src: el.getAttribute("src"),
                            alt: el.getAttribute("alt") || "",
                            title: el.getAttribute("title") || "",
                            layout: "full",
                        };
                    },
                },
            ];
        },
        renderHTML({ HTMLAttributes }) {
            const layout = HTMLAttributes["data-layout"] || HTMLAttributes.layout || "full";
            const isVideo = isVideoURL(HTMLAttributes.src || "");
            let figureClass = "my-6 text-center clear-both";
            let mediaClass = "rounded-2xl max-w-full my-2 border shadow-sm h-auto";

            if (layout === "full") {
                figureClass = "my-8 w-full text-center clear-both";
                mediaClass += " w-full mx-auto";
            } else if (layout === "center") {
                figureClass = "my-6 mx-auto max-w-2xl text-center clear-both";
                mediaClass += " mx-auto";
            } else if (layout === "left") {
                figureClass = "my-4 sm:float-left sm:mr-6 sm:mb-4 max-w-full sm:max-w-[48%] clear-left text-left";
                mediaClass += " w-full";
            } else if (layout === "right") {
                figureClass = "my-4 sm:float-right sm:ml-6 sm:mb-4 max-w-full sm:max-w-[48%] clear-right text-right";
                mediaClass += " w-full";
            }

            const cleanAttrs = { ...HTMLAttributes };
            delete cleanAttrs.layout;

            const mediaTag = isVideo ? "video" : "img";
            const mediaAttrs: Record<string, any> = {
                class: mediaClass,
            };
            if (isVideo) {
                mediaAttrs.controls = "true";
                mediaAttrs.playsinline = "true";
                mediaAttrs.preload = "metadata";
            }

            return [
                "figure",
                {
                    class: figureClass,
                    "data-layout": layout,
                },
                [
                    mediaTag,
                    mergeAttributes(
                        mediaAttrs,
                        cleanAttrs
                    ),
                ],
                HTMLAttributes.title
                    ? ["figcaption", { class: "text-xs text-content/70 italic mt-1" }, HTMLAttributes.title]
                    : "",
            ];
        },
    });

    export const PKBadge = Node.create({
        name: "pkBadge",
        group: "inline",
        inline: true,
        selectable: true,
        draggable: true,
        atom: true,
        addAttributes() {
            return {
                stage: { default: 1 },
                km: { default: 0 },
                label: { default: "" },
            };
        },
        parseHTML() {
            return [
                {
                    tag: "span[data-km]",
                    getAttrs: (dom) => {
                        const el = dom as HTMLElement;
                        return {
                            stage: parseInt(el.getAttribute("data-stage") || "1", 10),
                            km: parseFloat(el.getAttribute("data-km") || "0"),
                            label: el.getAttribute("data-label") || el.textContent?.trim() || "",
                        };
                    },
                },
            ];
        },
        renderHTML({ HTMLAttributes }) {
            const stage = HTMLAttributes.stage || 1;
            const km = HTMLAttributes.km || 0;
            const rawLabel = (HTMLAttributes.label || "")
                .replace(/^📍\s*/, "")
                .replace(/^Étape\s+\d+\s*[·•-]\s*/i, "")
                .replace(/^KM\s+[\d.]+\s*[·•-]\s*/i, "")
                .trim();
            const stageIdx = Math.max(0, stage - 1);
            const color = TRAIL_COLORS[stageIdx % TRAIL_COLORS.length];
            const text = rawLabel ? `KM ${km} · ${rawLabel}` : (stage > 1 ? `Étape ${stage} · KM ${km}` : `KM ${km}`);

            return [
                "span",
                mergeAttributes({
                    class: "mention pk-badge cursor-pointer font-bold inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs shadow-2xs mx-1 align-baseline select-none transition-all hover:opacity-85",
                    "data-stage": stage.toString(),
                    "data-km": km.toString(),
                    "data-label": rawLabel,
                    role: "button",
                    title: `Voir le repère sur la carte (Étape ${stage}, km ${km})`,
                    style: `background-color: ${color}20; color: ${color}; border: 1px solid ${color}45;`,
                }),
                ["i", { class: "fa-solid fa-location-dot text-[10px]" }],
                text,
            ];
        },
    });

    let element: HTMLElement;
    let editor: Editor | undefined = $state();

    let modal: Modal;
    let imageModal: Modal;
    let pkModal: Modal;

    interface Props {
        value?: string;
        label?: string;
        error?: string | string[] | null;
        placeholder?: string;
        extraClasses?: string;
        searchListPosition?: string;
        mediaItems?: ArticleMediaItem[];
        trails?: Trail[];
        stickyToolbar?: boolean;
        articleMode?: boolean;
    }

    let {
        value = $bindable(""),
        label = "",
        error = "",
        placeholder = "",
        extraClasses = "",
        searchListPosition = "absolute",
        mediaItems = [],
        trails = [],
        stickyToolbar = false,
        articleMode = false,
    }: Props = $props();

    let isArticleMode = $derived(
        articleMode || stickyToolbar || (mediaItems && mediaItems.length > 0) || (trails && trails.length > 0)
    );

    const fontSizes: SelectItem[] = [
        { text: $_("paragraph"), value: "p" },
        { text: `${$_("heading")} 1`, value: "h1" },
        { text: `${$_("heading")} 2`, value: "h2" },
        { text: `${$_("heading")} 3`, value: "h3" },
        { text: `${$_("heading")} 4`, value: "h4" },
        { text: `${$_("heading")} 5`, value: "h5" },
    ];

    let currentFontSize: string = $state("p");
    let linkURL: string = $state("");
    let linkURLError: string = $state("");
    let linkText: string = $state("");
    let openLinkInNewTab: boolean = $state(false);

    // Reactive active formatting state for real-time UI indicator
    let activeState = $state({
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        link: false,
        image: false,
        pkBadge: false,
        canUndo: false,
        canRedo: false,
    });

    function refreshActiveState() {
        if (!editor) return;
        activeState.bold = editor.isActive("bold");
        activeState.italic = editor.isActive("italic");
        activeState.strike = editor.isActive("strike");
        activeState.code = editor.isActive("code");
        activeState.codeBlock = editor.isActive("codeBlock");
        activeState.bulletList = editor.isActive("bulletList");
        activeState.orderedList = editor.isActive("orderedList");
        activeState.blockquote = editor.isActive("blockquote");
        activeState.link = editor.isActive("link");
        activeState.image = editor.isActive("image");
        activeState.pkBadge = editor.isActive("pkBadge");
        activeState.canUndo = editor.can().undo();
        activeState.canRedo = editor.can().redo();

        if (editor.isActive("paragraph")) {
            currentFontSize = "p";
        } else {
            for (let i = 1; i <= 5; i++) {
                if (editor.isActive("heading", { level: i as Level })) {
                    currentFontSize = "h" + i;
                    break;
                }
            }
        }
    }

    $effect(() => {
        value;
        untrack(() => {
            if (value !== editor?.getHTML()) {
                editor?.commands.setContent(value);
            }
        });
    });

    onMount(() => {
        editor = new Editor({
            element: element,
            extensions: [
                StarterKit.configure({
                    link: false,
                }),
                Placeholder.configure({
                    placeholder: placeholder,
                }),
                Mention.configure({
                    HTMLAttributes: {
                        class: "mention",
                    },
                    renderHTML({ node, options }) {
                        return [
                            "a",
                            mergeAttributes(
                                {
                                    href: `/profile/@${options.HTMLAttributes["data-label"]}`,
                                },
                                options.HTMLAttributes,
                            ),
                            options.renderText?.({
                                suggestion: {...options.suggestion, editor: editor!},
                                options: options,
                                node,
                            }),
                        ];
                    },
                    suggestion: {
                        allowToIncludeChar: true,
                        items: async ({ query }) => {
                            try {
                                const actors: ActorSearchResult[] = await searchActors(
                                    query,
                                    true,
                                );
                                return actors.map((a) => ({
                                    text: a.username!,
                                    description: `@${a.preferred_username}${a.is_local ? "" : "@" + a.domain}`,
                                    value: a,
                                    icon:
                                        a.icon ||
                                        `https://api.dicebear.com/7.x/initials/svg?seed=${a.preferred_username}&backgroundType=gradientLinear`,
                                }));
                            } catch (e) {
                                console.error(e);
                                show_toast({
                                    type: "error",
                                    icon: "close",
                                    text: "Error during search",
                                });
                                return [];
                            }
                        },

                        render: () => {
                            let component: DropdownList;
                            const componentState: any = $state({
                                items: [],
                                id: "mention-list",
                            });

                            function updatePosition({
                                clientRect,
                            }: SuggestionProps) {
                                const searchListElement =
                                    document.getElementById("mention-list");
                                if (!clientRect || !searchListElement) return;
                                const box = clientRect();
                                if (!box) {
                                    return;
                                }

                                searchListElement.style.position =
                                    searchListPosition;
                                searchListElement.style.top = `${box.bottom + window.scrollY + 4}px`;
                                searchListElement.style.left = `${box.left + window.scrollX}px`;
                                searchListElement.style.zIndex = "1001";
                            }

                            function onActorClick(props: SuggestionProps) {
                                return (_: Event, item: SearchItem) => {
                                    props.command({
                                        id: item.value.iri,
                                        label: `${item.value.preferred_username}${item.value.is_local ? "" : "@" + item.value.domain}`,
                                    });
                                };
                            }
                            return {
                                onStart: (props) => {
                                    props.clientRect;
                                    componentState.items = props.items;
                                    componentState.onclick =
                                        onActorClick(props);

                                    component = mount(SearchList, {
                                        target: element,
                                        props: componentState,
                                    });

                                    updatePosition(props);
                                },
                                onUpdate(props) {
                                    componentState.items = props.items;
                                    componentState.onclick =
                                        onActorClick(props);
                                    updatePosition(props);
                                },

                                onKeyDown(props) {
                                    if (props.event.key === "Escape") {
                                        this.onExit?.({} as unknown as any);

                                        return true;
                                    }

                                    return false;
                                },
                                onExit() {
                                    unmount(component);
                                },
                            };
                        },
                    },
                }),
                Link.configure({
                    openOnClick: false,
                    autolink: true,
                    defaultProtocol: "https",
                    protocols: ["http", "https"],
                    isAllowedUri: (url, ctx) => {
                        try {
                            const parsedUrl = url.includes(":")
                                ? new URL(url)
                                : new URL(`${ctx.defaultProtocol}://${url}`);

                            if (!ctx.defaultValidate(parsedUrl.href)) {
                                return false;
                            }

                            const disallowedProtocols = [
                                "ftp",
                                "file",
                                "mailto",
                            ];
                            const protocol = parsedUrl.protocol.replace(
                                ":",
                                "",
                            );

                            if (disallowedProtocols.includes(protocol)) {
                                return false;
                            }

                            const allowedProtocols = ctx.protocols.map((p) =>
                                typeof p === "string" ? p : p.scheme,
                            );

                            if (!allowedProtocols.includes(protocol)) {
                                return false;
                            }

                            return true;
                        } catch {
                            return false;
                        }
                    },
                }),
                CustomImage,
                PKBadge,
            ],
            content: value,
            onTransaction: () => {
                refreshActiveState();
            },
            onUpdate: (props) => {
                value = editor?.getHTML() ?? "";
                refreshActiveState();
            },
            editorProps: {
                attributes: {
                    class: `prose dark:prose-invert text-content p-4 min-h-[350px] resize-none transition-colors focus:outline-none max-w-none rounded-b-2xl ${extraClasses}`,
                },
                handleClickOn: (view, pos, node, nodePos, event, direct) => {
                    if (node.type.name === "pkBadge") {
                        view.dispatch(
                            view.state.tr.setSelection(
                                NodeSelection.create(view.state.doc, nodePos)
                            )
                        );
                        openPkModal();
                        return true;
                    }
                    return false;
                },
            },
            onSelectionUpdate: ({ editor: ed }) => {
                refreshActiveState();
                if (ed.isActive("paragraph")) {
                    currentFontSize = "p";
                    return;
                }
                for (let i = 1; i <= 5; i++) {
                    if (ed.isActive("heading", { level: i })) {
                        currentFontSize = "h" + i;
                        return;
                    }
                }
            },
        });
        refreshActiveState();
    });

    onDestroy(() => {
        if (editor) {
            editor.destroy();
        }
    });

    function openLinkModal() {
        linkURL = editor?.getAttributes("link").href ?? "";
        openLinkInNewTab = editor?.getAttributes("link").target === "_blank";
        if (linkURL) {
            editor?.chain().focus().extendMarkRange("link").run();
        }
        linkText =
            editor?.state.doc.textBetween(
                editor.state.selection.from,
                editor.state.selection.to,
                "",
            ) ?? "";

        modal.openModal();
    }

    function setLink() {
        linkURLError = "";

        if (linkURL === "") {
            linkURLError = $_("required");
            return;
        }
        try {
            z.string().url().parse(linkURL);
            editor
                ?.chain()
                .focus()
                .insertContent({
                    type: "text",
                    text: linkText || linkURL,
                    marks: [
                        {
                            type: "link",
                            attrs: {
                                href: linkURL,
                                target: openLinkInNewTab ? "_blank" : null,
                            },
                        },
                    ],
                })
                .run();

            modal.closeModal();
        } catch (e) {
            if (
                e instanceof ZodError &&
                e.errors[0].code === "invalid_string"
            ) {
                linkURLError = $_("not-a-valid-url");
            }
            console.error(e);
        }
    }

    function unsetLink() {
        editor?.chain().focus().extendMarkRange("link").unsetLink().run();
        modal.closeModal();
    }

    // Image Modal state
    let isEditingImage: boolean = $state(false);
    let imageSourceTab: "library" | "upload" = $state("library");
    let imageSrc: string = $state("");
    let imageAlt: string = $state("");
    let imageCaption: string = $state("");
    let imageLayout: "full" | "center" | "left" | "right" = $state("full");

    // PK Modal state
    let isEditingPk: boolean = $state(false);
    let pkModalStage: number = $state(1);
    let pkModalKm: number = $state(0);
    let pkModalLabel: string = $state("");
    let pkModalColor: string = $derived(
        TRAIL_COLORS[Math.max(0, pkModalStage - 1) % TRAIL_COLORS.length]
    );

    function openImageModal() {
        if (editor?.isActive("image")) {
            isEditingImage = true;
            const attrs = editor.getAttributes("image");
            imageSrc = attrs.src || "";
            imageAlt = attrs.alt || "";
            imageCaption = attrs.title || "";
            imageLayout = (attrs.layout as "full" | "center" | "left" | "right") || "full";
            imageSourceTab = "library";
        } else {
            isEditingImage = false;
            imageSrc = "";
            imageAlt = "";
            imageCaption = "";
            imageLayout = "full";
            imageSourceTab = mediaItems && mediaItems.length > 0 ? "library" : "upload";
        }
        imageModal.openModal();
    }

    function selectMediaItem(item: ArticleMediaItem) {
        imageSrc = item.url;
        if (!imageCaption) {
            imageCaption = item.caption || item.sourceTrailName || "";
        }
        if (!imageAlt) {
            imageAlt = item.caption || item.sourceTrailName || "";
        }
    }

    function handleImageUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                imageSrc = event.target.result as string;
                if (!imageCaption) {
                    imageCaption = file.name.replace(/\.[^/.]+$/, "");
                }
            }
        };
        reader.readAsDataURL(file);
    }

    function applyImage() {
        if (!imageSrc) return;
        if (isEditingImage) {
            editor
                ?.chain()
                .focus()
                .updateAttributes("image", {
                    src: imageSrc,
                    alt: imageAlt,
                    title: imageCaption,
                    layout: imageLayout,
                })
                .run();
        } else {
            editor
                ?.chain()
                .focus()
                .insertContent({
                    type: "image",
                    attrs: {
                        src: imageSrc,
                        alt: imageAlt,
                        title: imageCaption,
                        layout: imageLayout,
                    },
                })
                .run();
        }
        imageModal.closeModal();
    }

    function deleteCurrentImage() {
        if (editor?.isActive("image")) {
            editor?.chain().focus().deleteSelection().run();
        }
        imageModal.closeModal();
    }

    function openPkModal() {
        if (editor?.isActive("pkBadge")) {
            isEditingPk = true;
            const attrs = editor.getAttributes("pkBadge");
            pkModalStage = attrs.stage || 1;
            pkModalKm = attrs.km ?? 0;
            const raw = attrs.label || "";
            const isDefault =
                /^📍?\s*Étape\s+\d+\s*[·•-]\s*km\s*[\d.]+/i.test(raw) ||
                /^📍?\s*KM\s+[\d.]+/i.test(raw);
            pkModalLabel = isDefault
                ? ""
                : raw
                      .replace(/^📍\s*/, "")
                      .replace(/^Étape\s+\d+\s*[·•-]\s*/i, "")
                      .replace(/^KM\s+[\d.]+\s*[·•-]\s*/i, "")
                      .trim();
        } else {
            isEditingPk = false;
            pkModalStage = 1;
            pkModalKm = 0;
            pkModalLabel = "";
        }
        pkModal.openModal();
    }

    function applyPk() {
        if (isEditingPk) {
            editor
                ?.chain()
                .focus()
                .updateAttributes("pkBadge", {
                    stage: pkModalStage,
                    km: pkModalKm,
                    label: pkModalLabel.trim(),
                })
                .run();
        } else {
            insertPKBadge(pkModalStage, pkModalKm, pkModalLabel.trim() || undefined);
        }
        pkModal.closeModal();
    }

    function deleteCurrentPk() {
        if (editor?.isActive("pkBadge")) {
            editor?.chain().focus().deleteSelection().run();
        }
        pkModal.closeModal();
    }

    export function insertImage(
        src: string,
        alt: string = "",
        caption: string = "",
        layout: "full" | "center" | "left" | "right" = "full"
    ) {
        editor?.chain().focus().insertContent({
            type: "image",
            attrs: {
                src,
                alt,
                title: caption,
                layout,
            },
        }).run();
    }

    export function insertPKBadge(stage: number, km: number, label?: string) {
        editor?.chain().focus().insertContent({
            type: "pkBadge",
            attrs: {
                stage,
                km,
                label: label?.trim() || "",
            },
        }).run();
    }

    export function insertHTML(htmlContent: string) {
        editor?.chain().focus().insertContent(htmlContent).run();
    }

    export function getHTML(): string {
        return editor?.getHTML() ?? "";
    }
</script>

<div id="editor-wrapper" class="relative w-full">
    {#if label.length}
        <p class="text-sm font-medium mb-1.5 text-content">
            {label}
        </p>
    {/if}

    <div class="editor-container border border-input-border rounded-xl bg-input-background overflow-visible focus-within:border-input-border-focus transition-colors">
        <!-- Toolbar -->
        <div
            class="flex flex-wrap items-center py-2 px-3 gap-y-2 border-b border-input-border rounded-t-xl bg-surface/95 backdrop-blur-md z-30 transition-all {stickyToolbar ? 'sticky top-[72px] lg:top-[88px] shadow-2xs' : ''}"
        >
            <!-- History: Undo / Redo (only in article mode) -->
            {#if isArticleMode}
                <div class="flex gap-1 border-r border-input-border pr-2">
                    <button
                        type="button"
                        class="btn-icon"
                        disabled={!activeState.canUndo}
                        class:opacity-30={!activeState.canUndo}
                        onclick={() => editor?.chain().focus().undo().run()}
                        title="Annuler (Ctrl+Z)"
                        aria-label="Annuler"
                    >
                        <i class="fas fa-rotate-left"></i>
                    </button>
                    <button
                        type="button"
                        class="btn-icon"
                        disabled={!activeState.canRedo}
                        class:opacity-30={!activeState.canRedo}
                        onclick={() => editor?.chain().focus().redo().run()}
                        title="Rétablir (Ctrl+Y)"
                        aria-label="Rétablir"
                    >
                        <i class="fas fa-rotate-right"></i>
                    </button>
                </div>
            {/if}

            <!-- Paragraph & Headings using Wanderer's native Select -->
            <div class="mr-2 border-r border-input-border pr-2">
                <Select
                    items={fontSizes}
                    bind:value={currentFontSize}
                    extraClasses="h-8 py-0 text-xs font-medium"
                    onchange={(val: string) => {
                        if (val.startsWith("p")) {
                            editor?.chain().focus().setParagraph().run();
                        } else {
                            const level = parseInt(val.substring(1), 10) as Level;
                            editor?.chain().focus().setHeading({ level }).run();
                        }
                    }}
                />
            </div>

            <!-- Inline formatting -->
            <div class="flex gap-1 border-r border-input-border pr-2">
                <button
                    type="button"
                    class="btn-icon"
                    class:bg-primary={activeState.bold}
                    class:text-white={activeState.bold}
                    class:dark:text-stone-900={activeState.bold}
                    onclick={() => editor?.chain().focus().toggleBold().run()}
                    title="Gras (Ctrl+B)"
                    aria-label="Gras"
                >
                    <i class="fas fa-bold"></i>
                </button>
                <button
                    type="button"
                    class="btn-icon"
                    class:bg-primary={activeState.italic}
                    class:text-white={activeState.italic}
                    class:dark:text-stone-900={activeState.italic}
                    onclick={() => editor?.chain().focus().toggleItalic().run()}
                    title="Italique (Ctrl+I)"
                    aria-label="Italique"
                >
                    <i class="fas fa-italic"></i>
                </button>
                <button
                    type="button"
                    class="btn-icon"
                    class:bg-primary={activeState.strike}
                    class:text-white={activeState.strike}
                    class:dark:text-stone-900={activeState.strike}
                    onclick={() => editor?.chain().focus().toggleStrike().run()}
                    title="Barré"
                    aria-label="Barré"
                >
                    <i class="fas fa-strikethrough"></i>
                </button>
                {#if isArticleMode}
                    <button
                        type="button"
                        class="btn-icon"
                        class:bg-primary={activeState.code}
                        class:text-white={activeState.code}
                        class:dark:text-stone-900={activeState.code}
                        onclick={() => editor?.chain().focus().toggleCode().run()}
                        title="Code en ligne"
                        aria-label="Code en ligne"
                    >
                        <i class="fas fa-code"></i>
                    </button>
                {/if}
            </div>

            <!-- Lists & Blocks -->
            <div class="flex gap-1 border-r border-input-border pr-2">
                <button
                    type="button"
                    class="btn-icon"
                    class:bg-primary={activeState.bulletList}
                    class:text-white={activeState.bulletList}
                    class:dark:text-stone-900={activeState.bulletList}
                    onclick={() => editor?.chain().focus().toggleBulletList().run()}
                    title="Liste à puces"
                    aria-label="Liste à puces"
                >
                    <i class="fas fa-list-ul"></i>
                </button>
                <button
                    type="button"
                    class="btn-icon"
                    class:bg-primary={activeState.orderedList}
                    class:text-white={activeState.orderedList}
                    class:dark:text-stone-900={activeState.orderedList}
                    onclick={() => editor?.chain().focus().toggleOrderedList().run()}
                    title="Liste numérotée"
                    aria-label="Liste numérotée"
                >
                    <i class="fas fa-list-ol"></i>
                </button>
                <button
                    type="button"
                    class="btn-icon"
                    class:bg-primary={activeState.blockquote}
                    class:text-white={activeState.blockquote}
                    class:dark:text-stone-900={activeState.blockquote}
                    onclick={() => editor?.chain().focus().toggleBlockquote().run()}
                    title="Citation"
                    aria-label="Citation"
                >
                    <i class="fas fa-quote-right"></i>
                </button>
                {#if isArticleMode}
                    <button
                        type="button"
                        class="btn-icon"
                        class:bg-primary={activeState.codeBlock}
                        class:text-white={activeState.codeBlock}
                        class:dark:text-stone-900={activeState.codeBlock}
                        onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
                        title="Bloc de code"
                        aria-label="Bloc de code"
                    >
                        <i class="fas fa-file-code"></i>
                    </button>
                    <button
                        type="button"
                        class="btn-icon"
                        onclick={() => editor?.chain().focus().setHorizontalRule().run()}
                        title="Ligne de séparation"
                        aria-label="Ligne de séparation"
                    >
                        <i class="fas fa-minus"></i>
                    </button>
                {/if}
            </div>

            <!-- Inserts: Link, Image, PK Badge -->
            <div class="flex gap-1 px-1">
                <button
                    type="button"
                    class="btn-icon"
                    class:bg-primary={activeState.link}
                    class:text-white={activeState.link}
                    class:dark:text-stone-900={activeState.link}
                    onclick={() => openLinkModal()}
                    title="Lien"
                    aria-label="Lien"
                >
                    <i class="fas fa-link"></i>
                </button>
                {#if isArticleMode}
                    <button
                        type="button"
                        class="btn-icon"
                        class:bg-primary={activeState.image}
                        class:text-white={activeState.image}
                        class:dark:text-stone-900={activeState.image}
                        onclick={() => openImageModal()}
                        title="Insérer ou modifier une image"
                        aria-label="Image"
                    >
                        <i class="fas fa-image"></i>
                    </button>
                    <button
                        type="button"
                        class="btn-icon"
                        class:bg-primary={activeState.pkBadge}
                        class:text-white={activeState.pkBadge}
                        class:dark:text-stone-900={activeState.pkBadge}
                        onclick={() => openPkModal()}
                        title="Insérer ou modifier un repère kilométrique (PK)"
                        aria-label="Point Kilométrique"
                    >
                        <i class="fas fa-location-dot"></i>
                    </button>
                {/if}
            </div>
        </div>

        <div bind:this={element}></div>
    </div>

    {#if error}
        <span class="editor-error text-xs text-red-400 mt-1.5 block">
            {error instanceof Array ? $_(error[0]) : error}
        </span>
    {/if}
</div>

<Modal
    id="editor-modal"
    title={"Insert/edit link"}
    size="md:min-w-lg"
    bind:this={modal}
>
    {#snippet content()}
        <TextField label={"URL"} bind:value={linkURL} error={linkURLError}
        ></TextField>
        <TextField label={$_("text")} bind:value={linkText}></TextField>
        <Toggle
            label={$_("open-in-new-tab", { values: { n: 2 } })}
            bind:value={openLinkInNewTab}
        ></Toggle>
    {/snippet}
    {#snippet footer()}
        <div class="flex items-center gap-4">
            {#if editor?.getAttributes("link").href}
                <button
                    type="button"
                    class="btn-secondary shrink-0"
                    onclick={() => unsetLink()}
                    aria-label="Link"
                >
                    <i class="fas fa-link-slash"></i>
                    <span>{$_("unlink")}</span>
                </button>
                <div class="basis-full"></div>
            {/if}
            <button
                type="button"
                class="btn-secondary"
                onclick={() => modal.closeModal()}>{$_("cancel")}</button
            >
            <button
                class="btn-primary"
                type="button"
                name="save"
                onclick={() => setLink()}>{$_("save")}</button
            >
        </div>
    {/snippet}
</Modal>

<!-- Modal: Insert / Edit Image -->
<Modal
    id="editor-image-modal"
    title={isEditingImage ? "Modifier l'image" : "Insérer une image"}
    size="max-w-2xl"
    bind:this={imageModal}
>
    {#snippet content()}
        <div class="space-y-4">
            <!-- Source Selector Tabs (if not editing an existing image) -->
            {#if !isEditingImage}
                <div class="flex border-b border-separator gap-4">
                    {#if mediaItems && mediaItems.length > 0}
                        <button
                            type="button"
                            class="pb-2 text-xs font-bold transition-colors border-b-2 {imageSourceTab === 'library' ? 'border-primary text-primary' : 'border-transparent text-content/60 hover:text-content'}"
                            onclick={() => imageSourceTab = 'library'}
                        >
                            <i class="fa-solid fa-images mr-1"></i>
                            Photos des activités ({mediaItems.length})
                        </button>
                    {/if}
                    <button
                        type="button"
                        class="pb-2 text-xs font-bold transition-colors border-b-2 {imageSourceTab === 'upload' ? 'border-primary text-primary' : 'border-transparent text-content/60 hover:text-content'}"
                        onclick={() => imageSourceTab = 'upload'}
                    >
                        <i class="fa-solid fa-cloud-arrow-up mr-1"></i>
                        Téléverser / URL
                    </button>
                </div>
            {/if}

            <!-- Tab: Library of Media Items -->
            {#if !isEditingImage && imageSourceTab === 'library' && mediaItems && mediaItems.length > 0}
                <div class="space-y-2">
                    <span class="text-xs text-content/70 font-medium">
                        Sélectionnez un média issu de vos traces GPS :
                    </span>
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-56 overflow-y-auto p-1 border border-input-border rounded-xl bg-input-background/30">
                        {#each mediaItems as item}
                            <button
                                type="button"
                                onclick={() => selectMediaItem(item)}
                                class="relative aspect-square rounded-lg overflow-hidden border transition-all hover:opacity-90 {imageSrc === item.url ? 'ring-2 ring-primary border-primary scale-95 shadow-md' : 'opacity-80'}"
                            >
                                {#if isVideoURL(item.url)}
                                    <video src={item.url} class="w-full h-full object-cover pointer-events-none" muted preload="metadata"></video>
                                    <span class="absolute top-1 right-1 bg-black/70 rounded-full w-5 h-5 flex items-center justify-center text-white text-[10px]">
                                        <i class="fa-solid fa-play"></i>
                                    </span>
                                {:else}
                                    <img src={item.url} alt={item.caption || item.sourceTrailName} class="w-full h-full object-cover" />
                                {/if}
                                <span class="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white truncate px-1 py-0.5 text-center">
                                    {item.stageLabel}
                                </span>
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Tab: Upload or URL -->
            {#if isEditingImage || imageSourceTab === 'upload' || !mediaItems || mediaItems.length === 0}
                <div class="space-y-3">
                    {#if !isEditingImage}
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-content/70 mb-1">
                                Téléverser un fichier local (photo ou vidéo)
                            </label>
                            <input
                                type="file"
                                accept="image/*,video/*"
                                onchange={handleImageUpload}
                                class="file-input w-full text-xs"
                            />
                        </div>
                    {/if}

                    <div>
                        <label for="img-url-input" class="block text-xs font-bold uppercase tracking-wider text-content/70 mb-1">
                            URL de l'image ou de la vidéo
                        </label>
                        <input
                            id="img-url-input"
                            type="text"
                            bind:value={imageSrc}
                            placeholder="https://... ou téléversez ci-dessus"
                            class="input w-full text-xs"
                        />
                    </div>
                </div>
            {/if}

            <!-- Media Preview if selected -->
            {#if imageSrc}
                <div class="flex items-center gap-3 p-2 rounded-xl bg-input-background/40 border border-input-border">
                    {#if isVideoURL(imageSrc)}
                        <video src={imageSrc} class="w-16 h-16 object-cover rounded-lg border border-input-border shrink-0" muted preload="metadata"></video>
                    {:else}
                        <img src={imageSrc} alt="Aperçu" class="w-16 h-16 object-cover rounded-lg border border-input-border shrink-0" />
                    {/if}
                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-semibold text-content truncate">{imageSrc}</p>
                        <p class="text-[11px] text-content/70">
                            {isVideoURL(imageSrc) ? "Vidéo sélectionnée" : "Image sélectionnée"}
                        </p>
                    </div>
                    {#if !isEditingImage}
                        <button
                            type="button"
                            onclick={() => { imageSrc = ""; }}
                            class="btn-icon text-content/60 hover:text-red-500"
                            title="Désélectionner"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    {/if}
                </div>
            {/if}

            <!-- Layout Options -->
            <div class="space-y-1.5 pt-2 border-t border-input-border">
                <span class="block text-xs font-bold uppercase tracking-wider text-content">
                    Disposition / Mise en page
                </span>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                        type="button"
                        onclick={() => imageLayout = 'full'}
                        class="p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 {imageLayout === 'full' ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'bg-background border-input-border text-content/70 hover:text-content hover:bg-input-background/40'}"
                    >
                        <i class="fa-solid fa-arrows-left-right text-base"></i>
                        <span class="text-xs font-semibold">Pleine largeur</span>
                        <span class="text-[10px] text-content/60 leading-tight">Occupe toute la largeur</span>
                    </button>

                    <button
                        type="button"
                        onclick={() => imageLayout = 'center'}
                        class="p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 {imageLayout === 'center' ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'bg-background border-input-border text-content/70 hover:text-content hover:bg-input-background/40'}"
                    >
                        <i class="fa-solid fa-align-center text-base"></i>
                        <span class="text-xs font-semibold">Centrée</span>
                        <span class="text-[10px] text-content/60 leading-tight">Largeur normale</span>
                    </button>

                    <button
                        type="button"
                        onclick={() => imageLayout = 'left'}
                        class="p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 {imageLayout === 'left' ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'bg-background border-input-border text-content/70 hover:text-content hover:bg-input-background/40'}"
                    >
                        <i class="fa-solid fa-align-left text-base"></i>
                        <span class="text-xs font-semibold">Flottant gauche</span>
                        <span class="text-[10px] text-content/60 leading-tight">Texte à droite</span>
                    </button>

                    <button
                        type="button"
                        onclick={() => imageLayout = 'right'}
                        class="p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 {imageLayout === 'right' ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'bg-background border-input-border text-content/70 hover:text-content hover:bg-input-background/40'}"
                    >
                        <i class="fa-solid fa-align-right text-base"></i>
                        <span class="text-xs font-semibold">Flottant droite</span>
                        <span class="text-[10px] text-content/60 leading-tight">Texte à gauche</span>
                    </button>
                </div>
            </div>

            <!-- Caption & Alt text -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-input-border">
                <div>
                    <label for="img-caption" class="block text-xs font-bold uppercase tracking-wider text-content/70 mb-1">
                        Légende sous la photo
                    </label>
                    <input
                        id="img-caption"
                        type="text"
                        bind:value={imageCaption}
                        placeholder="Ex: Vue sur le lac d'Allos au petit matin"
                        class="input w-full text-xs"
                    />
                </div>
                <div>
                    <label for="img-alt" class="block text-xs font-bold uppercase tracking-wider text-content/70 mb-1">
                        Texte alternatif (accessibilité)
                    </label>
                    <input
                        id="img-alt"
                        type="text"
                        bind:value={imageAlt}
                        placeholder="Description de l'image"
                        class="input w-full text-xs"
                    />
                </div>
            </div>
        </div>
    {/snippet}
    {#snippet footer()}
        <div class="flex items-center justify-between w-full">
            {#if isEditingImage}
                <button
                    type="button"
                    class="btn-destructive text-xs py-1.5 px-3 rounded-xl flex items-center gap-1.5"
                    onclick={() => deleteCurrentImage()}
                >
                    <i class="fa-solid fa-trash-can"></i>
                    <span>Supprimer</span>
                </button>
            {:else}
                <div></div>
            {/if}
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="btn-secondary text-xs py-1.5 px-4 rounded-xl"
                    onclick={() => imageModal.closeModal()}
                >
                    Annuler
                </button>
                <button
                    type="button"
                    class="btn-primary text-xs py-1.5 px-5 rounded-xl flex items-center gap-1.5"
                    disabled={!imageSrc}
                    onclick={() => applyImage()}
                >
                    <i class="fa-solid fa-check"></i>
                    <span>{isEditingImage ? "Mettre à jour" : "Insérer l'image"}</span>
                </button>
            </div>
        </div>
    {/snippet}
</Modal>

<!-- Modal: Insert / Edit PK Badge -->
<Modal
    id="editor-pk-modal"
    title={isEditingPk ? "Modifier le repère kilométrique (PK)" : "Insérer un repère kilométrique (PK)"}
    size="max-w-md"
    bind:this={pkModal}
>
    {#snippet content()}
        <div class="space-y-4">
            <p class="text-xs text-content/70 leading-relaxed">
                Ce repère sera cliquable dans votre récit. En cliquant dessus, le lecteur sera automatiquement recentré sur la trace au niveau exact du kilomètre indiqué.
            </p>

            <div class="space-y-3">
                {#if trails && trails.length > 1}
                    <div>
                        <label for="pk-stage-select" class="block text-xs font-bold uppercase tracking-wider text-content/70 mb-1">
                            Étape associée
                        </label>
                        <select
                            id="pk-stage-select"
                            bind:value={pkModalStage}
                            class="input w-full text-xs"
                        >
                            {#each trails as t, idx}
                                <option value={idx + 1}>
                                    Étape {idx + 1} : {t.name}
                                </option>
                            {/each}
                        </select>
                    </div>
                {/if}

                <div>
                    <label for="pk-km-input" class="block text-xs font-bold uppercase tracking-wider text-content/70 mb-1">
                        Point kilométrique (km) *
                    </label>
                    <input
                        id="pk-km-input"
                        type="number"
                        min="0"
                        step="0.1"
                        bind:value={pkModalKm}
                        class="input w-full text-sm font-semibold"
                        placeholder="Ex: 14.5"
                    />
                </div>

                <div>
                    <label for="pk-label-input" class="block text-xs font-bold uppercase tracking-wider text-content/70 mb-1">
                        Libellé du lieu (optionnel)
                    </label>
                    <input
                        id="pk-label-input"
                        type="text"
                        bind:value={pkModalLabel}
                        placeholder="Ex: Col de la Bonette (2715m), Bivouac des lacs..."
                        class="input w-full text-xs"
                    />
                    <p class="text-[11px] text-content/60 mt-1">
                        Le kilomètre "KM {pkModalKm || 0}" sera automatiquement préfixé au libellé.
                    </p>
                </div>

                <!-- Live Badge Preview -->
                <div class="p-3 rounded-xl bg-input-background/40 border border-input-border flex items-center justify-between mt-2">
                    <span class="text-xs text-content/70 font-semibold">Aperçu dans le texte :</span>
                    <span
                        class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs select-none"
                        style="background-color: {pkModalColor}20; color: {pkModalColor}; border-color: {pkModalColor}45;"
                    >
                        <i class="fa-solid fa-location-dot text-[10px]"></i>
                        <span>
                            {pkModalLabel.trim() ? `KM ${pkModalKm || 0} · ${pkModalLabel.trim()}` : (trails && trails.length > 1 ? `Étape ${pkModalStage} · KM ${pkModalKm || 0}` : `KM ${pkModalKm || 0}`)}
                        </span>
                    </span>
                </div>
            </div>
        </div>
    {/snippet}
    {#snippet footer()}
        <div class="flex items-center justify-between gap-2 w-full">
            {#if isEditingPk}
                <button
                    type="button"
                    class="btn-secondary text-xs py-1.5 px-3 rounded-xl text-red-500 hover:text-red-700 hover:border-red-300 flex items-center gap-1.5"
                    onclick={deleteCurrentPk}
                >
                    <i class="fa-solid fa-trash-can"></i>
                    <span>Supprimer</span>
                </button>
            {:else}
                <div></div>
            {/if}
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="btn-secondary text-xs py-1.5 px-4 rounded-xl"
                    onclick={() => pkModal.closeModal()}
                >
                    Annuler
                </button>
                <button
                    type="button"
                    class="btn-primary text-xs py-1.5 px-5 rounded-xl flex items-center gap-1.5"
                    onclick={() => applyPk()}
                >
                    <i class="fa-solid fa-location-dot"></i>
                    <span>{isEditingPk ? "Mettre à jour le repère" : "Insérer le repère"}</span>
                </button>
            </div>
        </div>
    {/snippet}
</Modal>

<style>
    :global(.ProseMirror p.is-editor-empty:first-child::before) {
        content: attr(data-placeholder);
        float: left;
        color: #adb5bd;
        pointer-events: none;
        height: 0;
    }

    :global(.ProseMirror .pk-badge.ProseMirror-selectednode) {
        outline: 2px solid var(--primary, #d97706);
        outline-offset: 2px;
    }

    :global(.ProseMirror figure[data-layout="left"]) {
        float: left;
        max-width: 48%;
        margin: 0.5rem 1rem 0.5rem 0;
        clear: left;
    }
    :global(.ProseMirror figure[data-layout="right"]) {
        float: right;
        max-width: 48%;
        margin: 0.5rem 0 0.5rem 1rem;
        clear: right;
    }
    :global(.ProseMirror figure[data-layout="center"]) {
        margin: 1.5rem auto;
        max-width: 36rem;
        clear: both;
        text-align: center;
    }
    :global(.ProseMirror figure[data-layout="full"]) {
        margin: 1.5rem 0;
        width: 100%;
        clear: both;
        text-align: center;
    }
    :global(.ProseMirror figure.ProseMirror-selectednode img),
    :global(.ProseMirror figure.ProseMirror-selectednode video) {
        outline: 3px solid var(--primary, #d97706);
        outline-offset: 2px;
    }
    :global(.ProseMirror figure img),
    :global(.ProseMirror figure video) {
        border-radius: 0.75rem;
        height: auto;
        max-width: 100%;
    }
</style>
