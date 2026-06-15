<script lang="ts">
    let {
        coverImage = $bindable(),
        onCoverUpload,
        coverUploading,
        coverError,
    } = $props<{
        coverImage: string | null;
        onCoverUpload: (e: Event) => void;
        coverUploading: boolean;
        coverError: string;
    }>();

    function removeCoverImage() {
        coverImage = null;
    }
</script>

<div class="space-y-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
    <span
        class="block text-xs font-semibold text-zinc-400 tracking-wide uppercase"
        >Cover Image</span
    >
    <div class="grid md:grid-cols-2 gap-4 items-start">
        <div class="space-y-2">
            <label
                for="journal-cover-image-url"
                class="block text-xs text-zinc-500">Cover Image URL</label
            >
            <input
                id="journal-cover-image-url"
                type="text"
                bind:value={coverImage}
                placeholder="https://example.com/image.jpg"
                class="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
            />
            <div class="flex items-center gap-2">
                <label
                    class="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-medium cursor-pointer transition-colors border border-zinc-700/50 flex items-center gap-1.5"
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
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                    </svg>
                    Upload File
                    <input
                        type="file"
                        accept="image/*"
                        onchange={onCoverUpload}
                        class="hidden"
                    />
                </label>
                {#if coverUploading}
                    <div class="flex items-center gap-1 text-xs text-zinc-500">
                        <div
                            class="w-3 h-3 border border-zinc-700 border-t-accent-400 rounded-full animate-spin"
                        ></div>
                        Uploading...
                    </div>
                {/if}
                {#if coverImage}
                    <button
                        type="button"
                        onclick={() => removeCoverImage()}
                        class="px-2 py-1.5 rounded hover:bg-red-500/10 text-red-400 text-xs font-medium transition-colors"
                        >Remove Cover</button
                    >
                {/if}
            </div>
            {#if coverError}
                <p class="text-xs text-red-400 mt-1">
                    {coverError}
                </p>
            {/if}
        </div>
        <div
            class="flex items-center justify-center border border-zinc-800/80 rounded-lg bg-zinc-950 p-2 min-h-[100px]"
        >
            {#if coverImage}
                <img
                    src={coverImage}
                    alt="Cover Preview"
                    class="max-h-[120px] rounded object-cover aspect-video shadow border border-zinc-800"
                    onerror={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                    }}
                />
            {:else}
                <span class="text-xs text-zinc-600">No cover image preview</span
                >
            {/if}
        </div>
    </div>
</div>
