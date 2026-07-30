<script lang="ts">
  import AppButton from "./AppButton.svelte";

  let {
    onSignOut,
    todayHref,
    onTodayClick,
    children,
  }: {
    onSignOut: () => void;
    todayHref?: string;
    onTodayClick?: () => void;
    children?: import("svelte").Snippet;
  } = $props();
</script>

<div class="flex items-center gap-2">
  {#if todayHref}
    <AppButton variant="accent-ghost" size="sm" href={todayHref}>Today</AppButton>
  {:else if onTodayClick}
    <AppButton variant="ghost" size="sm" onclick={onTodayClick}>Today</AppButton>
  {/if}
  {@render children?.()}
  <AppButton variant="secondary" size="sm" onclick={onSignOut}>Sign Out</AppButton>
</div>
