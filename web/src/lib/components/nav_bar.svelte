<script lang="ts">
    import { afterNavigate, goto } from "$app/navigation";
    import { page } from "$app/state";
    import { theme, toggleTheme } from "$lib/stores/theme_store";
    import { currentUser, logout } from "$lib/stores/user_store";
    import { getFileURL } from "$lib/util/file_util";
    import type { AuthRecord } from "pocketbase";
    import { _ } from "svelte-i18n";
    import { backInOut, cubicOut } from "svelte/easing";
    import { Tween } from "svelte/motion";
    import Drawer from "./base/drawer.svelte";
    import Dropdown from "./base/dropdown.svelte";
    import NotificationDropdown from "./notification/notification_dropdown.svelte";
    import GlobalSearchModal from "./search/global_search_modal.svelte";
    import UrlImportModal from "./settings/url_import_modal.svelte";

    interface Props {
        user: AuthRecord;
    }

    let { user }: Props = $props();
    const navUser = $derived($currentUser ?? user);

    let navBarItems = $derived([
        { text: $_("home"), value: "/" },
        { text: "Magazine", value: "/articles" },
        { text: $_("trail", { values: { n: 2 } }), value: "/trails" },
        { text: $_("map"), value: "/map" },
        { text: $_("list", { values: { n: 2 } }), value: "/lists" },
    ]);

    let createDropdownItems = $derived([
        { text: $_("new-trail") || "Nouvel itinéraire", value: "new-trail", icon: "route" },
        { text: $_("new-story") || "Nouveau récit", value: "new-article", icon: "feather" },
        { text: $_("from-url") || "Depuis une URL", value: "url", icon: "cloud-arrow-down" },
    ]);

    let dropdownItems = $derived([
        { text: $_("profile"), value: "profile", icon: "user" },
        { text: $_("my-trails"), value: "trails", icon: "route" },
        { text: $_("settings"), value: "settings", icon: "cog" },
        { text: $_("logout"), value: "logout", icon: "right-from-bracket" },
    ]);

    const indicatorPosition = new Tween(0, {
        duration: 300,
        easing: cubicOut,
    });

    const indicatorWidth = new Tween(0, {
        duration: 300,
        easing: cubicOut,
    });

    const indicatorScale = new Tween(0, {
        duration: 600,
        easing: backInOut,
    });

    let drawerOpen: boolean = $state(false);

    let urlImportModal: UrlImportModal;
    let globalSearchModal: GlobalSearchModal;

    afterNavigate((e) => {
        const routeId = e.to?.route.id;
        const navBarLinks = document.getElementById("nav-bar-links");
        let childPosition = -1;
        switch (routeId) {
            case "/":
                childPosition = 1;
                break;
            case "/articles":
            case "/articles/[id]":
            case "/articles/new":
                childPosition = 2;
                break;
            case "/trails":
                childPosition = 3;
                break;
            case "/map":
                childPosition = 4;
                break;
            case "/lists/[[handle]]/[[id]]":
                childPosition = 5;
                break;
            default:
                break;
        }

        if (childPosition !== -1) {
            const childElement = navBarLinks?.children[
                childPosition
            ] as HTMLElement;
            const newWidth = childElement?.getBoundingClientRect().width ?? 0;
            const newPosition = childElement.offsetLeft;
            const padding = 16;
            indicatorScale.set(1);
            indicatorWidth.set(newWidth + padding);
            indicatorPosition.set(newPosition - padding / 2);
        } else {
            indicatorScale.set(0);
        }
    });

    function handleCreateDropdownClick(item: { text: string; value: any }) {
        if (item.value === "new-trail") {
            window.location.href = "/trail/edit/new";
        } else if (item.value === "new-article") {
            goto("/articles/new");
        } else if (item.value === "url") {
            urlImportModal.openModal();
        }
    }

    function handleDropdownClick(item: { text: string; value: any }) {
        if (item.value == "profile") {
            goto(`/profile/@${$currentUser?.username?.toLowerCase()}`);
        } else if (item.value == "trails") {
            goto(`/profile/@${$currentUser?.username?.toLowerCase()}/trails`);
        } else if (item.value == "logout") {
            logout();
            window.location.href = "/";
        } else if (item.value == "settings") {
            goto("/settings/profile");
        }
    }
</script>

<Drawer bind:open={drawerOpen}>
    <div class="flex gap-4 items-center m-4">
        <button
            aria-label="Rechercher"
            class="btn-icon fa fa-search"
            onclick={() => {
                drawerOpen = false;
                globalSearchModal?.openModal();
            }}
        ></button>
        <button
            aria-label="Toggle theme"
            class="btn-icon fa-regular fa-{$theme === 'light' ? 'sun' : 'moon'}"
            onclick={() => toggleTheme()}
        ></button>
        <div class="basis-full"></div>
        <button
            aria-label="Toggle drawer"
            class="btn-icon block fa fa-close float-right"
            onclick={() => (drawerOpen = false)}
        ></button>
    </div>
    <div class="flex flex-col px-12 gap-8">
        {#each navBarItems as item}
            <a
                class="font-semibold text-xl"
                href={item.value}
                onclick={() => (drawerOpen = false)}>{item.text}</a
            >
        {/each}
    </div>
    <hr class="my-6 border-input-border" />
    <div class="flex flex-col basis-full">
        {#if navUser}
            <div class="flex flex-col gap-2.5 mx-4">
                <a
                    class="btn-primary text-center flex items-center justify-center gap-2"
                    href="/trail/edit/new"
                    onclick={() => (drawerOpen = false)}
                >
                    <i class="fa fa-route"></i>
                    <span>{$_("new-trail") || "Nouvel itinéraire"}</span>
                </a>
                <a
                    class="btn-secondary text-center flex items-center justify-center gap-2"
                    href="/articles/new"
                    onclick={() => (drawerOpen = false)}
                >
                    <i class="fa fa-feather"></i>
                    <span>{$_("new-story") || "Nouveau récit"}</span>
                </a>
                <button
                    class="btn-secondary text-center flex items-center justify-center gap-2"
                    onclick={() => {
                        drawerOpen = false;
                        urlImportModal.openModal();
                    }}
                >
                    <i class="fa fa-cloud-arrow-down"></i>
                    <span>{$_("from-url") || "Depuis une URL"}</span>
                </button>
            </div>
            <div class="basis-full"></div>
            <hr class="border-input-border my-4" />
            <div class="flex gap-4 items-center justify-between m-4">
                <a
                    class="shrink-0"
                    href="/profile/@{navUser.username.toLowerCase()}"
                    onclick={() => (drawerOpen = false)}
                >
                    <img
                        class="rounded-full w-10 aspect-square"
                        src={getFileURL(navUser, navUser.avatar) ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${navUser.username.toLowerCase()}&backgroundType=gradientLinear`}
                        alt="avatar"
                    />
                </a>
                <a
                    href="/profile/@{navUser.username.toLowerCase()}"
                    style="width: calc(100% - 104px)"
                    onclick={() => (drawerOpen = false)}
                >
                    <p class="text-sm overflow-hidden text-ellipsis">
                        {navUser.username}
                    </p>
                    <p
                        class="text-sm text-gray-500 overflow-hidden text-ellipsis"
                    >
                        {navUser.email}
                    </p>
                </a>
                <button
                    aria-label="Logout"
                    onclick={() => {
                        logout();
                        window.location.href = "/";
                    }}
                    class="btn-icon"
                    ><i class="fa-solid fa-arrow-right-from-bracket"
                    ></i></button
                >
            </div>
        {:else}
            <a class="btn-primary btn-large text-center mx-4" href="/login"
                >{$_("login")}</a
            >
        {/if}
    </div>
</Drawer>

<nav
    class="flex justify-between items-center p-6 {page.url.pathname === '/'
        ? 'sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-input-border/60 shadow-2xs'
        : ''}"
>
    <a href="/" class="text-2xl font-serif font-black tracking-tight text-content select-none hover:opacity-90 transition-opacity">
        TraceClub
    </a>
    <menu id="nav-bar-links" class="hidden lg:flex gap-8 relative py-1 px-2">
        <div
            class="absolute h-full w-16 bg-menu-item-background-hover rounded-xl top-0 z-0"
            style="width: {indicatorWidth.current}px; left: {indicatorPosition.current}px; scale: {indicatorScale.current}"
        ></div>
        {#each navBarItems as item}
            <a class="font-semibold z-10" href={item.value}>{item.text}</a>
        {/each}
    </menu>
    {#if navUser}
        <div class="hidden lg:flex gap-4 items-center">
            <button
                aria-label="Rechercher"
                class="btn-icon fa fa-search"
                onclick={() => globalSearchModal?.openModal()}
                title="Rechercher (Cmd+K)"
            ></button>
            <button
                aria-label="Toggle theme"
                class="btn-icon fa-regular fa-{$theme === 'light'
                    ? 'sun'
                    : 'moon'}"
                onclick={() => toggleTheme()}
            ></button>
            <Dropdown
                items={createDropdownItems}
                onchange={(item) => handleCreateDropdownClick(item)}
            >
                {#snippet children({ toggleMenu: openDropdown })}
                    <button
                        onclick={openDropdown}
                        class="btn-primary btn-large flex items-center gap-2"
                        type="button"
                        aria-label="Nouveau"
                    >
                        <i class="fa fa-plus"></i>
                        <span>{$_("new") || "Nouveau"}</span>
                        <i class="fa fa-caret-down text-xs ml-1"></i>
                    </button>
                {/snippet}
            </Dropdown>
            {#if page.data.notifications}
                <NotificationDropdown></NotificationDropdown>
            {/if}
            <Dropdown
                items={dropdownItems}
                onchange={(item) => handleDropdownClick(item)}
            >
                {#snippet children({ toggleMenu: openDropdown })}
                    <div class="flex items-center">
                        <button
                            aria-label="Open user menu"
                            class="rounded-full bg-white text-black hover:bg-gray-200 focus:ring-4 ring-gray-100/50 transition-colors h-10 aspect-square"
                            onclick={openDropdown}
                        >
                            <img
                                class="rounded-full w-full h-full"
                                src={getFileURL(navUser, navUser.avatar) ||
                                    `https://api.dicebear.com/7.x/initials/svg?seed=${navUser.username.toLowerCase()}&backgroundType=gradientLinear`}
                                alt="avatar"
                            />
                        </button>
                    </div>
                {/snippet}
            </Dropdown>
        </div>
    {:else}
        <div class="hidden md:flex items-center gap-4">
            <button
                aria-label="Rechercher"
                class="btn-icon fa fa-search"
                onclick={() => globalSearchModal?.openModal()}
                title="Rechercher (Cmd+K)"
            ></button>
            <button
                aria-label="Toggle theme"
                class="btn-icon fa-regular fa-{$theme === 'light'
                    ? 'sun'
                    : 'moon'}"
                onclick={() => toggleTheme()}
            ></button>
            <a class="btn-primary btn-large" href="/login">{$_("login")}</a>
        </div>
    {/if}
    <button
        aria-label="Toggle drawer"
        class="btn-icon fa fa-bars lg:hidden"
        onclick={() => (drawerOpen = !drawerOpen)}
    ></button>
</nav>

<UrlImportModal bind:this={urlImportModal}></UrlImportModal>
<GlobalSearchModal bind:this={globalSearchModal}></GlobalSearchModal>
