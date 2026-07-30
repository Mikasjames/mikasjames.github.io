<script lang="ts">
  let {
    opacity = '2' as '2' | '3',
    class: className = '',
  } = $props();
</script>

<div
  class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.0{opacity})_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.0{opacity})_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none {className}"
></div>
