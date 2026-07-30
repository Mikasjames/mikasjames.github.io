<script lang="ts">
  let {
    variant = 'secondary' as 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent-ghost',
    size = 'md' as 'sm' | 'md' | 'lg',
    href = undefined as string | undefined,
    disabled = false,
    loading = false,
    class: className = '',
    children,
    ...rest
  } = $props();

  const base = 'inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50';

  const variantClasses: Record<string, Record<string, string>> = {
    primary: {
      sm: 'rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500',
      md: 'rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-600/20 hover:bg-accent-500',
      lg: 'rounded-lg bg-accent-600 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-500',
    },
    secondary: {
      sm: 'rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700',
      md: 'rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700',
      lg: 'rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700',
    },
    ghost: {
      sm: 'rounded-lg border border-zinc-700/60 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-accent-500/50 hover:text-accent-300',
      md: 'rounded-lg border border-zinc-700/60 px-4 py-2 text-sm font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
      lg: 'rounded-lg border border-zinc-700/60 px-5 py-2.5 text-sm font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
    },
    danger: {
      sm: 'rounded border border-red-500/20 px-2 py-1 text-xs text-red-400 hover:border-red-500/40 hover:text-red-300',
      md: 'rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-400 hover:border-red-500/40 hover:text-red-300',
      lg: 'rounded-lg border border-red-500/20 px-4 py-2 text-sm text-red-400 hover:border-red-500/40 hover:text-red-300',
    },
    'accent-ghost': {
      sm: 'rounded-lg border border-accent-500/30 bg-accent-600/10 px-3 py-2 text-xs font-semibold text-accent-300 hover:border-accent-500/50 hover:bg-accent-600/20',
      md: 'rounded-lg border border-accent-500/30 bg-accent-600/10 px-4 py-2 text-sm font-medium text-accent-300 hover:border-accent-500/50 hover:bg-accent-600/20',
      lg: 'rounded-lg border border-accent-500/30 bg-accent-600/10 px-5 py-2.5 text-sm font-medium text-accent-300 hover:border-accent-500/50 hover:bg-accent-600/20',
    },
  };

  const cls = $derived(`${base} ${variantClasses[variant][size]} ${className}`.trim());

  const spinnerCls = $derived(
    variant === 'primary' || variant === 'secondary'
      ? 'w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0'
      : 'w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin shrink-0',
  );
</script>

{#if href}
  <a {href} class={cls} {...rest}>
    {#if loading}
      <div class={spinnerCls}></div>
    {/if}
    {@render children?.()}
  </a>
{:else}
  <button {disabled} class={cls} {...rest}>
    {#if loading}
      <div class={spinnerCls}></div>
    {/if}
    {@render children?.()}
  </button>
{/if}
