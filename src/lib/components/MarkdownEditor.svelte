<script lang="ts">
    import { tick } from "svelte";
    import {
        computeFormattedSelection,
        type FormatAction,
    } from "$lib/utils/markdownEditor";
    import { renderMarkdown } from "$lib/utils/renderMarkdown";
    import {
        getImageDimensionsFromUrl,
        type ImageMeta,
    } from "$lib/utils/imageMeta";

    let {
        content = $bindable<string>(""),
        imageMeta = $bindable<Record<string, ImageMeta>>({}),
        textareaRef = $bindable<HTMLTextAreaElement | null>(null),
        activeTab = $bindable<"write" | "preview">("write"),
        id,
        placeholderText = "Write content here… Markdown is supported.",
        onOpenMediaGallery,
    } = $props<{
        content: string;
        imageMeta: Record<string, ImageMeta>;
        textareaRef?: HTMLTextAreaElement | null;
        activeTab?: "write" | "preview";
        id: string;
        placeholderText?: string;
        onOpenMediaGallery?: () => void;
    }>();

    async function applyFormat(action: FormatAction) {
        activeTab = "write";
        await tick();
        if (!textareaRef) return;

        const start = textareaRef.selectionStart;
        const end = textareaRef.selectionEnd;

        const { newContent, cursorStart, cursorEnd } =
            computeFormattedSelection(content, start, end, action);

        content = newContent;

        await tick();

        if (textareaRef) {
            textareaRef.focus();
            textareaRef.selectionStart = cursorStart;
            textareaRef.selectionEnd = cursorEnd;
        }
    }

    async function handleKeyDown(e: KeyboardEvent) {
        const isModifier = e.ctrlKey || e.metaKey;
        if (!isModifier) return;

        switch (e.key.toLowerCase()) {
            case "b":
                e.preventDefault();
                await applyFormat({
                    kind: "wrap",
                    before: "**",
                    after: "**",
                    placeholder: "bold text",
                });
                break;
            case "i":
                e.preventDefault();
                await applyFormat({
                    kind: "wrap",
                    before: "_",
                    after: "_",
                    placeholder: "italic text",
                });
                break;
            case "k":
                e.preventDefault();
                await applyFormat({
                    kind: "wrap",
                    before: "[",
                    after: "](url)",
                    placeholder: "link text",
                });
                break;
            case "q":
                e.preventDefault();
                await applyFormat({
                    kind: "prefix",
                    prefix: "> ",
                    placeholder: "quoted text",
                });
                break;
        }
    }

    async function insertMarkdownAtCursor(url: string, altText: string) {
        activeTab = "write";
        await tick();
        if (!textareaRef) return;

        const start = textareaRef.selectionStart;
        const end = textareaRef.selectionEnd;

        const before = content.substring(0, start);
        const after = content.substring(end, content.length);
        const tag = `![${altText}](${url})`;

        content = before + tag + after;

        await tick();

        if (textareaRef) {
            textareaRef.focus();
            textareaRef.selectionStart = textareaRef.selectionEnd =
                start + tag.length;
        }
    }

    async function insertVideoEmbedAtCursor(url: string, title: string) {
        activeTab = "write";
        await tick();
        if (!textareaRef) return;

        const start = textareaRef.selectionStart;
        const end = textareaRef.selectionEnd;

        const before = content.substring(0, start);
        const after = content.substring(end, content.length);
        const tag = `!video[${title}](${url})`;

        content = before + tag + after;

        await tick();

        if (textareaRef) {
            textareaRef.focus();
            textareaRef.selectionStart = textareaRef.selectionEnd =
                start + tag.length;
        }
    }

    async function promptInsertImage() {
        const url = window.prompt("Image URL");
        if (!url) return;
        const trimmed = url.trim();
        const alt = window.prompt("Alt text", "Image")?.trim() || "Image";

        if (!imageMeta[trimmed]) {
            try {
                const dims = await getImageDimensionsFromUrl(trimmed);
                imageMeta = { ...imageMeta, [trimmed]: dims };
            } catch {
                // Insert without dimensions when probing fails.
            }
        }

        await insertMarkdownAtCursor(trimmed, alt);
    }

    async function promptInsertVideo() {
        const url = window.prompt(
            "Video URL (YouTube, Vimeo, or direct .mp4/.webm/.ogg)",
        );
        if (!url) return;
        const title =
            window
                .prompt(
                    "Video title",
                    textareaRef
                        ? textareaRef.value.substring(
                              textareaRef.selectionStart,
                              textareaRef.selectionEnd,
                          )
                        : "Video",
                )
                ?.trim() || "Video";
        await insertVideoEmbedAtCursor(url.trim(), title);
    }
</script>

{#snippet toolbarButton(
    titleText: string,
    action: FormatAction,
    iconPath?: string,
    textIcon?: string,
)}
    <button
        type="button"
        title={titleText}
        onmousedown={(e) => e.preventDefault()}
        onclick={() => applyFormat(action)}
        class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer font-bold text-[11px] flex items-center justify-center min-w-[28px] h-[28px]"
    >
        {#if iconPath}
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d={iconPath} />
            </svg>
        {:else}
            <span
                class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer font-bold text-[11px] leading-none px-1"
                >{textIcon}</span
            >
        {/if}
    </button>
{/snippet}

<div class="space-y-2">
    <div
        class="flex items-center justify-between border-b border-zinc-800/80 pb-2"
    >
        <label
            for={id}
            class="block text-xs font-semibold text-zinc-400 tracking-wide uppercase"
            >Content</label
        >
        <div class="flex items-center gap-3">
            <button
                type="button"
                onmousedown={(e) => e.preventDefault()}
                onclick={onOpenMediaGallery}
                class="px-2.5 py-1 text-xs font-medium text-accent-400 hover:text-accent-300 hover:bg-accent-500/10 rounded-md border border-accent-500/20 transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
            >
                <svg
                    class="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                </svg>
                Media Gallery
            </button>
            <div
                class="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800"
            >
                <button
                    type="button"
                    onclick={() => (activeTab = "write")}
                    class="px-2.5 py-0.5 text-xs font-medium rounded-md transition-all duration-150 {activeTab ===
                    'write'
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-305'}">Write</button
                >
                <button
                    type="button"
                    onclick={() => (activeTab = "preview")}
                    class="px-2.5 py-0.5 text-xs font-medium rounded-md transition-all duration-150 {activeTab ===
                    'preview'
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-305'}">Preview</button
                >
            </div>
        </div>
    </div>

    {#if activeTab === "write"}
        <div
            class="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-zinc-950 border border-zinc-800 border-b-0 rounded-t-lg"
            role="toolbar"
            aria-label="Markdown formatting toolbar"
        >
            {@render toolbarButton(
                "Bold (Ctrl+B)",
                {
                    kind: "wrap",
                    before: "**",
                    after: "**",
                    placeholder: "bold text",
                },
                "M13.5 15.5H10V12.5H13.5C14.33 12.5 15 13.17 15 14C15 14.83 14.33 15.5 13.5 15.5ZM10 6.5H13C13.83 6.5 14.5 7.17 14.5 8C14.5 8.83 13.83 9.5 13 9.5H10V6.5ZM15.6 11.29C16.57 10.61 17.25 9.53 17.25 8.5C17.25 6.26 15.5 4.5 13.25 4.5H7V19.5H14.04C16.13 19.5 17.75 17.8 17.75 15.75C17.75 14.24 16.88 12.96 15.6 11.29Z",
            )}
            {@render toolbarButton(
                "Italic",
                {
                    kind: "wrap",
                    before: "_",
                    after: "_",
                    placeholder: "italic text",
                },
                "M10 4V7H12.21L8.79 15H6V18H14V15H11.79L15.21 7H18V4H10Z",
            )}
            {@render toolbarButton(
                "Strikethrough",
                {
                    kind: "wrap",
                    before: "~~",
                    after: "~~",
                    placeholder: "strikethrough text",
                },
                "M6.85 7.08C6.85 4.37 9.45 3 12.24 3C13.64 3 14.89 3.36 15.83 4.07C16.77 4.77 17.28 5.75 17.28 6.96H14.7C14.7 6.43 14.44 5.99 13.92 5.65C13.4 5.31 12.87 5.11 12.23 5.11C11.34 5.11 10.62 5.35 10.09 5.82C9.56 6.29 9.29 6.84 9.29 7.49C9.29 8.04 9.49 8.5 9.91 8.76C10.13 8.9 10.86 9.13 11.31 9.2L12.17 9.33C12.89 9.44 13.49 9.62 14 9.8H17.67C17.91 9.23 18.03 8.62 18.03 8H20.62C20.62 9.66 19.99 11.12 18.88 12.17C18.83 12.22 18.75 12.26 18.7 12.31H22V14H2V12.31H12.23C11.99 12.26 11.73 12.2 11.43 12.14C10.26 11.97 9.38 11.56 8.71 10.95C7.91 10.22 7.44 9.24 7.44 8H9.09C9.09 8.36 9.27 8.71 9.54 8.99C9.85 9.3 10.27 9.5 10.77 9.63C11.12 9.73 11.66 9.84 12.17 9.97V9.5C12.08 9.5 11.98 9.46 11.88 9.44C11.47 9.36 10.78 9.16 10.36 8.91C9.78 8.55 9.49 8.06 9.49 7.49C9.49 6.78 9.77 6.23 10.32 5.84C10.87 5.45 11.56 5.25 12.38 5.25C13.19 5.25 13.84 5.45 14.33 5.84C14.83 6.24 15.07 6.74 15.07 7.33H17.65C17.65 6.09 17.09 5.09 15.98 4.36C14.86 3.63 13.62 3.25 12.24 3.25C10.65 3.25 9.28 3.65 8.17 4.44C7.07 5.24 6.52 6.29 6.52 7.59C6.52 8.56 6.85 9.38 7.52 10.05C7.68 10.21 7.85 10.35 8.04 10.48H6.85V7.08ZM14.7 17H12.1C11.08 17 10.27 16.74 9.69 16.21C9.11 15.68 8.83 14.98 8.83 14.12V14.09H6.22V14.12C6.22 15.47 6.79 16.58 7.94 17.44C9.09 18.3 10.51 18.75 12.24 18.75C13.82 18.75 15.1 18.38 16.1 17.63C17.1 16.88 17.59 15.9 17.59 14.67C17.59 14.21 17.52 13.78 17.38 13.38H14.7V17Z",
            )}
            <div class="w-px h-4 bg-zinc-800 mx-1"></div>
            {@render toolbarButton(
                "Inline Code",
                { kind: "wrap", before: "`", after: "`", placeholder: "code" },
                "M9.4 16.6L4.8 12L9.4 7.4L8 6L2 12L8 18L9.4 16.6ZM14.6 16.6L19.2 12L14.6 7.4L16 6L22 12L16 18L14.6 16.6Z",
            )}
            {@render toolbarButton(
                "Code Block",
                {
                    kind: "block",
                    before: "```\n",
                    after: "\n```",
                    placeholder: "code here",
                },
                "",
                "```",
            )}
            <div class="w-px h-4 bg-zinc-800 mx-1"></div>
            {@render toolbarButton(
                "Heading 1",
                { kind: "prefix", prefix: "# ", placeholder: "Heading 1" },
                "",
                "H1",
            )}
            {@render toolbarButton(
                "Heading 2",
                { kind: "prefix", prefix: "## ", placeholder: "Heading 2" },
                "",
                "H2",
            )}
            {@render toolbarButton(
                "Heading 3",
                { kind: "prefix", prefix: "### ", placeholder: "Heading 3" },
                "",
                "H3",
            )}
            <div class="w-px h-4 bg-zinc-800 mx-1"></div>
            {@render toolbarButton(
                "Blockquote",
                { kind: "prefix", prefix: "> ", placeholder: "quoted text" },
                "M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z",
            )}
            {@render toolbarButton(
                "Unordered List",
                { kind: "prefix", prefix: "- ", placeholder: "list item" },
                "M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z",
            )}
            {@render toolbarButton(
                "Ordered List",
                { kind: "prefix", prefix: "1. ", placeholder: "list item" },
                "M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z",
            )}
            <div class="w-px h-4 bg-zinc-800 mx-1"></div>
            {@render toolbarButton(
                "Link",
                {
                    kind: "wrap",
                    before: "[",
                    after: "](url)",
                    placeholder: "link text",
                },
                "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
            )}

            <button
                type="button"
                title="Image"
                onmousedown={(e) => e.preventDefault()}
                onclick={promptInsertImage}
                class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
                <svg
                    class="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path
                        d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2Zm-2 0H5V5h14v14Z"
                    />
                    <path d="M8 14h2l1.5 2 2-3 2.5 3H18V8l-3.5 3-2-2L8 14Z" />
                </svg>
            </button>
            <button
                type="button"
                title="Video"
                onmousedown={(e) => e.preventDefault()}
                onclick={promptInsertVideo}
                class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
                <svg
                    class="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path
                        d="M10 8.64L15.27 12 10 15.36V8.64ZM4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                    />
                </svg>
            </button>

            {@render toolbarButton(
                "Horizontal Rule",
                {
                    kind: "block",
                    before: "\n\n---\n\n",
                    after: "",
                    placeholder: "",
                },
                "M19 13H5v-2h14v2z",
            )}
        </div>
        <textarea
            {id}
            bind:value={content}
            bind:this={textareaRef}
            onkeydown={handleKeyDown}
            required
            rows="14"
            placeholder={placeholderText}
            class="w-full px-3.5 py-2.5 rounded-b-lg rounded-t-none bg-zinc-900 border border-zinc-700/60 border-t-zinc-800 text-zinc-100 text-sm placeholder-zinc-650 font-mono leading-relaxed resize-y focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
        ></textarea>
    {:else}
        <div
            class="w-full min-h-[350px] max-h-[550px] px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-850 overflow-y-auto"
        >
            <article
                class="prose-custom text-zinc-400 leading-relaxed text-[0.96rem] text-left"
            >
                {#if content.trim()}
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html renderMarkdown(content, imageMeta)}
                {:else}
                    <p class="text-zinc-600 italic text-sm text-center py-10">
                        Nothing to preview yet.
                    </p>
                {/if}
            </article>
        </div>
    {/if}
</div>
