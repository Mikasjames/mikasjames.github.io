<script lang="ts">
    let {
        showMediaGallery = $bindable(),
        mediaItems,
        mediaUploading,
        mediaUploadError,
        handleGalleryUpload,
        handleDeleteMedia,
        copyToClipboard,
        insertMarkdownAtCursor,
        setEditorCoverImage,
        mediaLoading,
        deletingMediaIds,
    } = $props();
</script>

{#if showMediaGallery}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 backdrop-blur-md transition-opacity duration-300 sm:p-4"
        role="dialog"
        aria-modal="true"
    >
        <div
            class="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
        >
            <div
                class="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:items-center sm:px-6 sm:py-4"
            >
                <div class="min-w-0">
                    <h3 class="text-lg font-bold text-zinc-100">
                        Media Gallery
                    </h3>
                    <p class="text-xs text-zinc-500 mt-0.5">
                        Upload, manage, and insert assets into your post.
                    </p>
                </div>
                <button
                    type="button"
                    onclick={() => (showMediaGallery = false)}
                    class="text-zinc-400 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-800 rounded-lg cursor-pointer"
                    aria-label="Close Gallery"
                >
                    <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>

            <div
                class="flex flex-col gap-3 border-b border-zinc-850 bg-zinc-950 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6"
            >
                <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <label
                        class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-accent-600/20 transition-colors hover:bg-accent-500 sm:w-auto"
                    >
                        <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                        </svg>
                        Upload New Image
                        <input
                            type="file"
                            accept="image/*"
                            onchange={handleGalleryUpload}
                            class="hidden"
                        />
                    </label>

                    {#if mediaUploading}
                        <div
                            class="flex items-center gap-1.5 text-xs text-zinc-400 animate-pulse"
                        >
                            <div
                                class="w-3.5 h-3.5 border-2 border-zinc-700 border-t-accent-500 rounded-full animate-spin"
                            ></div>
                            Uploading to storage...
                        </div>
                    {/if}

                    {#if mediaUploadError}
                        <span class="break-words text-xs text-red-400"
                            >{mediaUploadError}</span
                        >
                    {/if}
                </div>

                <div class="text-xs text-zinc-500 font-mono sm:text-right">
                    {mediaItems.length} assets indexed
                </div>
            </div>

            <div class="min-h-[300px] flex-1 overflow-y-auto p-4 sm:p-6">
                {#if mediaLoading}
                    <div
                        class="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500"
                    >
                        <div
                            class="w-8 h-8 border-2 border-zinc-700 border-t-accent-500 rounded-full animate-spin"
                        ></div>
                        <p class="text-sm">Loading gallery assets...</p>
                    </div>
                {:else if mediaItems.length === 0}
                    <div
                        class="flex flex-col items-center justify-center py-20 text-center"
                    >
                        <svg
                            class="w-12 h-12 text-zinc-700 mb-3"
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
                        <p class="text-zinc-405 text-sm font-medium">
                            No assets found
                        </p>
                        <p class="text-zinc-600 text-xs mt-1">
                            Upload your first image to get started.
                        </p>
                    </div>
                {:else}
                    <div
                        class="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                    >
                        {#each mediaItems as item (item.id)}
                            {@const isDeleting = deletingMediaIds.has(item.id)}
                            <div
                                class="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950 transition-all duration-200 hover:border-zinc-750 lg:aspect-square"
                            >
                                <img
                                    src={item.url}
                                    alt={item.name}
                                    class="h-44 w-full object-cover transition-transform duration-300 min-[430px]:h-36 md:h-40 lg:h-full lg:group-hover:scale-105"
                                    loading="lazy"
                                />

                                <div
                                    class="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-left transition-opacity duration-200 lg:block lg:group-hover:opacity-0"
                                >
                                    <p
                                        class="text-[10px] font-mono text-zinc-300 truncate"
                                    >
                                        {item.name}
                                    </p>
                                </div>

                                <div
                                    class="flex flex-col justify-between gap-3 bg-zinc-950 p-3 transition-all duration-200 lg:absolute lg:inset-0 lg:bg-black/85 lg:opacity-0 lg:group-hover:opacity-100"
                                >
                                    <div
                                        class="flex items-start justify-between gap-2"
                                    >
                                        <p
                                            class="text-[10px] text-zinc-450 truncate font-mono flex-1 text-left"
                                            title={item.name}
                                        >
                                            {item.name}
                                        </p>
                                        <button
                                            type="button"
                                            onclick={() =>
                                                handleDeleteMedia(item)}
                                            disabled={isDeleting}
                                            class="shrink-0 cursor-pointer rounded border border-red-900/40 bg-red-950/40 p-1 text-red-400 transition-colors hover:border-red-700/60 hover:bg-red-900/60 disabled:opacity-50"
                                            title="Delete image"
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
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                            </svg>
                                        </button>
                                    </div>

                                    <div class="flex flex-col gap-1.5">
                                        <button
                                            type="button"
                                            onmousedown={(e) =>
                                                e.preventDefault()}
                                            onclick={() =>
                                                insertMarkdownAtCursor(
                                                    item.url,
                                                    item.name.split(".")[0],
                                                    {
                                                        width: item.width,
                                                        height: item.height,
                                                    },
                                                )}
                                            class="flex w-full cursor-pointer items-center justify-center gap-1 rounded bg-accent-600 px-2 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent-500 lg:py-1"
                                        >
                                            <svg
                                                class="w-3 h-3"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="2"
                                                    d="M12 4v16m8-8H4"
                                                />
                                            </svg>
                                            Insert Markdown
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() => {
                                                setEditorCoverImage(item.url);
                                                alert(
                                                    "Set cover image successfully!",
                                                );
                                            }}
                                            class="flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-zinc-750 bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 lg:py-1"
                                        >
                                            Set as Cover
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() =>
                                                copyToClipboard(
                                                    `![${item.name.split(".")[0]}](${item.url})`,
                                                )}
                                            class="w-full cursor-pointer rounded px-2 py-1.5 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-850 hover:text-zinc-200 lg:py-1"
                                        >
                                            Copy Link Tag
                                        </button>
                                    </div>
                                </div>

                                {#if isDeleting}
                                    <div
                                        class="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center"
                                    >
                                        <div
                                            class="w-6 h-6 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin"
                                        ></div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Footer -->
            <div
                class="flex justify-end border-t border-zinc-800 bg-zinc-950 px-4 py-3 sm:px-6 sm:py-4"
            >
                <button
                    type="button"
                    onclick={() => (showMediaGallery = false)}
                    class="w-full cursor-pointer rounded-lg border border-zinc-700/50 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 sm:w-auto"
                >
                    Close Gallery
                </button>
            </div>
        </div>
    </div>
{/if}
