<script lang="ts">
  let {
    size = 'md' as 'xs' | 'sm' | 'md' | 'lg' | 'xl',
    color = 'accent' as 'accent' | 'white' | 'zinc' | 'danger',
    class: className = '',
  } = $props();

  const sizeMap: Record<string, string> = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  const colorMap: Record<string, string> = {
    accent: 'border-accent-500/20 border-t-accent-500',
    white: 'border-white/30 border-t-white',
    zinc: 'border-zinc-600 border-t-zinc-300',
    danger: 'border-zinc-700 border-t-red-500',
  };
</script>

<div
  class="rounded-full animate-spin border-2 {sizeMap[size]} {colorMap[color]} {className}"
></div>
