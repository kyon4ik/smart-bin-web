<script>
  import { icons } from '../icons.js';
  let { name, size = 20 } = $props();
</script>

<svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d={icons[name]} />
</svg>
