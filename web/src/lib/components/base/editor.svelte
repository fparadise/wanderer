<script lang="ts">
    import { Editor, mergeAttributes, Node } from "@tiptap/core";
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
    import { type SelectItem } from "./select.svelte";
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
                        const img = el.querySelector("img");
                        const figcaption = el.querySelector("figcaption");
                        return {
                            src: img?.getAttribute("src") || null,
                            alt: img?.getAttribute("alt") || "",
                            title: figcaption?.textContent?.trim() || img?.getAttribute("title") || "",
                            layout: el.getAttribute("data-layout") || "full",
                        };
                    },
                },
                {
                    tag: "figure",
                    getAttrs: (dom) => {
                        const el = dom as HTMLElement;
                        const img = el.querySelector("img");
                        const figcaption = el.querySelector("figcaption");
                        return {
                            src: img?.getAttribute("src") || null,
                            alt: img?.getAttribute("alt") || "",
                            title: figcaption?.textContent?.trim() || img?.getAttribute("title") || "",
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
            ];
        },
        renderHTML({ HTMLAttributes }) {
            const layout = HTMLAttributes["data-layout"] || HTMLAttributes.layout || "full";
            let figureClass = "my-6 text-center clear-both";
            let imgClass = "rounded-2xl max-w-full my-2 border shadow-sm object-cover max-h-[550px]";

            if (layout === "full") {
                figureClass = "my-8 w-full text-center clear-both";
                imgClass += " w-full mx-auto";
            } else if (layout === "center") {
                figureClass = "my-6 mx-auto max-w-2xl text-center clear-both";
                imgClass += " mx-auto";
            } else if (layout === "left") {
                figureClass = "my-4 sm:float-left sm:mr-6 sm:mb-4 max-w-full sm:max-w-[48%] clear-left text-left";
                imgClass += " w-full";
            } else if (layout === "right") {
                figureClass = "my-4 sm:float-right sm:ml-6 sm:mb-4 max-w-full sm:max-w-[48%] clear-right text-right";
                imgClass += " w-full";
            }

            const cleanAttrs = { ...HTMLAttributes };
            delete cleanAttrs.layout;

            return [
                "figure",
                {
                    class: figureClass,
                    "data-layout": layout,
                },
                [
                    "img",
                    mergeAttributes(
                        {
                            class: imgClass,
                        },
                        cleanAttrs
                    ),
                ],
                HTMLAttributes.title
                    ? ["figcaption", { class: "text-xs text-muted-foreground italic mt-1" }, HTMLAttributes.title]
                    : "",
            ];
        },
    });

    export const PKBadge = Node.create({
        name: "pkBadge",
        group: "inline",
        inline: true,
        selectable: true,
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
                    class: "mention pk-badge cursor-pointer font-bold inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs shadow-2xs mx-1 align-baseline select-none transition-all",
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
    }: Props = $props();

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
            onTransaction: ({ editor: newEditor }) => {
                // force re-render so `editor.isActive` works as expected
                editor = undefined;
                editor = newEditor;
            },
            onUpdate: (props) => {
                value = editor?.getHTML() ?? "";
            },
            editorProps: {
                attributes: {
                    class: `prose dark:prose-invert text-content bg-input-background border border-input-border rounded-md p-3 resize-none transition-colors focus:border-input-border-focus focus:outline-none focus:ring-0 ${extraClasses}`,
                },
            },
            onSelectionUpdate: ({ editor }) => {
                if (editor.isActive("paragraph")) {
                    currentFontSize = "p";
                    return;
                }
                for (let i = 1; i <= 5; i++) {
                    if (editor.isActive("heading", { level: i })) {
                        currentFontSize = "h" + i;
                        return;
                    }
                }
            },
        });
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
        pkModalStage = 1;
        pkModalKm = 0;
        pkModalLabel = "";
        pkModal.openModal();
    }

    function applyPk() {
        insertPKBadge(pkModalStage, pkModalKm, pkModalLabel.trim() || undefined);
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
                label: label || `📍 Étape ${stage} · km ${km}`,
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

<div id="editor-wrapper">
    {#if label.length}
        <p class="text-sm font-medium mb-1">
            {label}
        </p>
    {/if}
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center py-2 gap-y-2">
        <div class="mr-2">
            <!-- <Select
                items={fontSizes}
                bind:value={currentFontSize}
                onchange={(value: string) => {
                    if (value.startsWith("p")) {
                        editor?.chain().focus().setParagraph().run();
                    } else {
                        editor
                            ?.chain()
                            .focus()
                            .setHeading({
                                level: parseInt(value.substring(1)) as Level,
                            })
                            .run();
                    }
                }}
            ></Select> -->
        </div>
        <div class="flex gap-2 border-r border-input-border pr-2">
            <button
                type="button"
                class="btn-icon"
                onclick={() => editor?.chain().focus().toggleBold().run()}
                class:ring-2={editor?.isActive("bold")}
                aria-label="Bold"
            >
                <i class="fas fa-bold"></i>
            </button>

            <button
                type="button"
                class="btn-icon"
                onclick={() => editor?.chain().focus().toggleItalic().run()}
                class:ring-2={editor?.isActive("italic")}
                aria-label="Italic"
            >
                <i class="fas fa-italic"></i>
            </button>

            <button
                type="button"
                class="btn-icon"
                onclick={() => editor?.chain().focus().toggleUnderline().run()}
                class:ring-2={editor?.isActive("underline")}
                aria-label="Underline"
            >
                <i class="fas fa-underline"></i>
            </button>
        </div>

        <div class="flex gap-1 border-r border-input-border px-2">
            <button
                type="button"
                class="btn-icon"
                onclick={() => editor?.chain().focus().toggleBulletList().run()}
                class:ring-2={editor?.isActive("bulletList")}
                aria-label="Bullet List"
            >
                <i class="fas fa-list-ul"></i>
            </button>

            <button
                type="button"
                class="btn-icon"
                onclick={() =>
                    editor?.chain().focus().toggleOrderedList().run()}
                class:ring-2={editor?.isActive("orderedList")}
                aria-label="Numbered List"
            >
                <i class="fas fa-list-ol"></i>
            </button>
        </div>

        <div class="flex gap-1 border-r border-input-border px-2">
            <button
                type="button"
                class="btn-icon"
                onclick={() => editor?.chain().focus().toggleBlockquote().run()}
                class:ring-2={editor?.isActive("blockquote")}
                aria-label="Quote"
            >
                <i class="fas fa-quote-right"></i>
            </button>
        </div>

        <div class="flex gap-1 border-r border-input-border px-2">
            <button
                type="button"
                class="btn-icon"
                onclick={() => openLinkModal()}
                class:ring-2={editor?.isActive("link")}
                aria-label="Link"
            >
                <i class="fas fa-link"></i>
            </button>
        </div>

        <!-- Image and PK Insertion -->
        <div class="flex gap-1 px-2">
            <button
                type="button"
                class="btn-icon"
                onclick={() => openImageModal()}
                class:ring-2={editor?.isActive("image")}
                title="Insérer ou modifier une image"
                aria-label="Image"
            >
                <i class="fas fa-image"></i>
            </button>

            <button
                type="button"
                class="btn-icon text-primary hover:text-primary"
                onclick={() => openPkModal()}
                title="Insérer un repère kilométrique (PK)"
                aria-label="Point Kilométrique"
            >
                <i class="fas fa-location-dot"></i>
            </button>
        </div>
    </div>
    <div bind:this={element}></div>

    {#if error}
        <span class="editor-error text-xs text-red-400">
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
                            class="pb-2 text-xs font-bold transition-colors border-b-2 {imageSourceTab === 'library' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
                            onclick={() => imageSourceTab = 'library'}
                        >
                            <i class="fa-solid fa-images mr-1"></i>
                            Photos des activités ({mediaItems.length})
                        </button>
                    {/if}
                    <button
                        type="button"
                        class="pb-2 text-xs font-bold transition-colors border-b-2 {imageSourceTab === 'upload' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
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
                    <span class="text-xs text-muted-foreground font-medium">
                        Sélectionnez une photo issue de vos traces GPS :
                    </span>
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-56 overflow-y-auto p-1 border rounded-xl bg-card/50">
                        {#each mediaItems as item}
                            <button
                                type="button"
                                onclick={() => selectMediaItem(item)}
                                class="relative aspect-square rounded-lg overflow-hidden border transition-all hover:opacity-90 {imageSrc === item.url ? 'ring-2 ring-primary border-primary scale-95 shadow-md' : 'opacity-80'}"
                            >
                                <img src={item.url} alt={item.caption || item.sourceTrailName} class="w-full h-full object-cover" />
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
                            <label class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                Téléverser un fichier local
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onchange={handleImageUpload}
                                class="file-input w-full text-xs"
                            />
                        </div>
                    {/if}

                    <div>
                        <label for="img-url-input" class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            URL de l'image
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

            <!-- Image Preview if selected -->
            {#if imageSrc}
                <div class="flex items-center gap-3 p-2 rounded-xl bg-card border">
                    <img src={imageSrc} alt="Aperçu" class="w-16 h-16 object-cover rounded-lg border shrink-0" />
                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-semibold text-foreground truncate">{imageSrc}</p>
                        <p class="text-[11px] text-muted-foreground">Image sélectionnée</p>
                    </div>
                    {#if !isEditingImage}
                        <button
                            type="button"
                            onclick={() => { imageSrc = ""; }}
                            class="btn-icon text-muted-foreground hover:text-red-500"
                            title="Désélectionner"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    {/if}
                </div>
            {/if}

            <!-- Layout Options -->
            <div class="space-y-1.5 pt-2 border-t">
                <span class="block text-xs font-bold uppercase tracking-wider text-foreground">
                    Disposition / Mise en page
                </span>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                        type="button"
                        onclick={() => imageLayout = 'full'}
                        class="p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 {imageLayout === 'full' ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'bg-card text-muted-foreground hover:text-foreground'}"
                    >
                        <i class="fa-solid fa-arrows-left-right text-base"></i>
                        <span class="text-xs font-semibold">Pleine largeur</span>
                        <span class="text-[10px] text-muted-foreground leading-tight">Occupe toute la largeur</span>
                    </button>

                    <button
                        type="button"
                        onclick={() => imageLayout = 'center'}
                        class="p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 {imageLayout === 'center' ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'bg-card text-muted-foreground hover:text-foreground'}"
                    >
                        <i class="fa-solid fa-align-center text-base"></i>
                        <span class="text-xs font-semibold">Centrée</span>
                        <span class="text-[10px] text-muted-foreground leading-tight">Largeur normale</span>
                    </button>

                    <button
                        type="button"
                        onclick={() => imageLayout = 'left'}
                        class="p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 {imageLayout === 'left' ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'bg-card text-muted-foreground hover:text-foreground'}"
                    >
                        <i class="fa-solid fa-align-left text-base"></i>
                        <span class="text-xs font-semibold">Flottant gauche</span>
                        <span class="text-[10px] text-muted-foreground leading-tight">Texte à droite</span>
                    </button>

                    <button
                        type="button"
                        onclick={() => imageLayout = 'right'}
                        class="p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 {imageLayout === 'right' ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'bg-card text-muted-foreground hover:text-foreground'}"
                    >
                        <i class="fa-solid fa-align-right text-base"></i>
                        <span class="text-xs font-semibold">Flottant droite</span>
                        <span class="text-[10px] text-muted-foreground leading-tight">Texte à gauche</span>
                    </button>
                </div>
            </div>

            <!-- Caption & Alt text -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                <div>
                    <label for="img-caption" class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
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
                    <label for="img-alt" class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
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

<!-- Modal: Insert PK Badge -->
<Modal
    id="editor-pk-modal"
    title="Insérer un repère kilométrique (PK)"
    size="max-w-md"
    bind:this={pkModal}
>
    {#snippet content()}
        <div class="space-y-4">
            <p class="text-xs text-muted-foreground leading-relaxed">
                Ce repère sera cliquable dans votre récit. En cliquant dessus, le lecteur sera automatiquement recentré sur la trace au niveau exact du kilomètre indiqué.
            </p>

            <div class="space-y-3">
                {#if trails && trails.length > 1}
                    <div>
                        <label for="pk-stage-select" class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
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
                    <label for="pk-km-input" class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
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
                    <label for="pk-label-input" class="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Libellé du lieu (optionnel)
                    </label>
                    <input
                        id="pk-label-input"
                        type="text"
                        bind:value={pkModalLabel}
                        placeholder="Ex: Col de la Bonette (2715m), Bivouac des lacs..."
                        class="input w-full text-xs"
                    />
                    <p class="text-[11px] text-muted-foreground mt-1">
                        Le kilomètre "KM {pkModalKm || 0}" sera automatiquement préfixé au libellé.
                    </p>
                </div>

                <!-- Live Badge Preview -->
                <div class="p-3 rounded-xl bg-card border flex items-center justify-between mt-2">
                    <span class="text-xs text-muted-foreground font-semibold">Aperçu dans le texte :</span>
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
        <div class="flex items-center justify-end gap-2 w-full">
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
                <span>Insérer le repère</span>
            </button>
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
    :global(.ProseMirror figure img) {
        border-radius: 0.75rem;
    }
</style>
