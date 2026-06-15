<script lang="ts">
    import type { MediaItem } from "$lib/firebase/firestore.svelte";

    let {
        showMediaGallery = $bindable(),
        handleContentUpload,
        contentUploading,
        contentUploadError,
        mediaItems,
        mediaLoadError,
        insertMarkdownAtCursor,
        setEditorCoverImage,
    } = $props<{
        showMediaGallery: boolean;
        handleContentUpload: (e: Event) => void;
        contentUploading: boolean;
        contentUploadError: string;
        mediaItems: MediaItem[];
        mediaLoadError: string;
        insertMarkdownAtCursor: (
            url: string,
            altText: string,
            dims: { width: number; height: number },
        ) => void;
        setEditorCoverImage: (url: string) => void;
    }>();
</script>

<div class="space-y-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
    <div class="flex justify-between items-center flex-wrap gap-2">
        <div>
            <span
                class="block text-xs font-semibold text-zinc-400 tracking-wide uppercase"
                >Content Images Helper</span
            >
            <p class="text-[10px] text-zinc-550 mt-0.5">
                Upload new assets or reuse existing gallery images.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <button
                type="button"
                onmousedown={(e) => e.preventDefault()}
                onclick={() => (showMediaGallery = true)}
                class="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700/50 transition-colors cursor-pointer"
            >
                Manage Gallery
            </button>
            <label
                class="px-2.5 py-1.5 rounded bg-accent-600/20 hover:bg-accent-600/30 text-accent-300 text-xs font-medium cursor-pointer transition-colors border border-accent-500/20 flex items-center gap-1.5"
            >
                <svg
                    class="w-3.5 h-3.5 text-accent-400"
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
                Upload New Image
                <input
                    type="file"
                    accept="image/*"
                    onchange={handleContentUpload}
                    class="hidden"
                />
            </label>
        </div>
    </div>

    {#if contentUploading}
        <div class="flex items-center gap-1.5 text-xs text-zinc-500">
            <div
                class="w-3.5 h-3.5 border-2 border-zinc-700 border-t-accent-500 rounded-full animate-spin"
            ></div>
            Uploading and indexing asset...
        </div>
    {/if}

    {#if contentUploadError}
        <p class="text-xs text-red-400">
            {contentUploadError}
        </p>
    {/if}

    {#if mediaLoadError}
        <div
            class="p-3 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-xs space-y-1"
        >
            <p class="font-semibold">Gallery Load Failed:</p>
            <p class="text-zinc-405 leading-normal">
                {mediaLoadError}
            </p>
        </div>
    {/if}

    {#if mediaItems.length > 0}
        <div class="space-y-2 mt-2">
            <p
                class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider"
            >
                Recent Gallery Images
            </p>
            <div
                class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1"
            >
                {#each mediaItems.slice(0, 4) as img (img.id)}
                    <div
                        class="flex items-center justify-between gap-3 p-2 rounded bg-zinc-950 border border-zinc-850 text-xs hover:border-zinc-800 transition-colors"
                    >
                        <div class="flex items-center gap-2 min-w-0">
                            <img
                                src={img.url}
                                alt=""
                                class="w-8 h-8 object-cover rounded bg-zinc-900 border border-zinc-800 shrink-0"
                            />
                            <span
                                class="text-zinc-300 truncate font-mono text-[11px]"
                                title={img.name}>{img.name}</span
                            >
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onmousedown={(e) => e.preventDefault()}
                                onclick={() =>
                                    insertMarkdownAtCursor(
                                        img.url,
                                        img.name.split(".")[0],
                                        {
                                            width: img.width,
                                            height: img.height,
                                        },
                                    )}
                                class="px-2 py-1 rounded bg-accent-600/10 hover:bg-accent-600/20 text-accent-300 font-medium transition-colors text-[10px] cursor-pointer"
                                title="Insert image into editor content"
                            >
                                Insert
                            </button>
                            <button
                                type="button"
                                onclick={() => {
                                    setEditorCoverImage(img.url);
                                    alert("Set cover image successfully!");
                                }}
                                class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors text-[10px] cursor-pointer"
                            >
                                Cover
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {:else}
        <p class="text-xs text-zinc-650 py-2">
            No images found in your media gallery. Upload one to get started!
        </p>
    {/if}
</div>
