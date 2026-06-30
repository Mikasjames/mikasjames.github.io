<script lang="ts">
    import { fade } from "svelte/transition";
</script>

<div
    out:fade={{ duration: 400 }}
    class="fixed inset-0 z-50 flex items-center justify-center bg-[#09090b]"
>
    <div class="relative w-32 h-32 flex items-center justify-center">
        <svg
            class="absolute inset-0 w-full h-full text-[#c084fc]"
            viewBox="0 0 128 128"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect
                x="2"
                y="2"
                width="124"
                height="124"
                rx="16"
                stroke="currentColor"
                stroke-width="4"
                class="draw-container"
            />

            <path
                d="M44 40L64 60L44 80"
                stroke="currentColor"
                stroke-width="6"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="draw-bracket"
            />

            <path
                d="M72 80H88"
                stroke="currentColor"
                stroke-width="6"
                stroke-linecap="round"
                class="blink-cursor"
            />
        </svg>
    </div>
</div>

<style>
    .draw-container {
        stroke-dasharray: 500;
        stroke-dashoffset: 500;
        animation: drawContainerEffect 1.2s cubic-bezier(0.4, 0, 0.2, 1)
            forwards;
        will-change: stroke-dashoffset;
    }

    .draw-bracket {
        stroke-dasharray: 60;
        stroke-dashoffset: 60;
        animation: drawBracketEffect 0.8s ease-in-out 0.3s forwards;
        will-change: stroke-dashoffset;
    }

    .blink-cursor {
        opacity: 0;
        animation: blinkEffect 1s infinite steps(2, start) 1.1s;
    }

    @keyframes drawContainerEffect {
        to {
            stroke-dashoffset: 0;
        }
    }

    @keyframes drawBracketEffect {
        to {
            stroke-dashoffset: 0;
        }
    }

    @keyframes blinkEffect {
        0%,
        49% {
            opacity: 1;
        }
        50%,
        100% {
            opacity: 0;
        }
    }
</style>
