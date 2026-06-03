<script lang="ts">
    import { onMount } from "svelte";

    let activeSkillTab = $state("Frontend");
    let visibleSections = $state<Set<string>>(new Set());

    const skillTabs = ["Frontend", "Backend", "Cloud & Tools", "QA", "AI"];

    const skills: Record<string, string[]> = {
        Frontend: [
            "TypeScript",
            "JavaScript",
            "Svelte / SvelteKit",
            "Angular",
            "React",
            "Tailwind CSS",
            "HTML5 / CSS3",
        ],
        Backend: [
            "Python",
            "Django",
            "Node.js",
            "Express",
            "PostgreSQL",
            "MongoDB",
        ],
        "Cloud & Tools": [
            "Google Cloud (GCP)",
            "Docker",
            "Git / GitHub",
            "Linux",
            "VS Code",
        ],
        QA: [
            "Playwright",
            "Cypress",
            "Jest",
            "E2E Testing",
            "Manual Test Docs",
        ],
        AI: [
            "LLM Integration",
            "Prompt Optimization",
            "AI-Assisted Tools",
            "RAG Pipelines",
        ],
    };

    const experience = [
        {
            id: "data-analytics-2",
            company: "Codefrost",
            role: "Software Engineer",
            period: "Oct 2025 – Present",
            tag: "Data & Analytics",
            color: "indigo",
            points: [
                "Developing and maintaining complex web applications focused on data visualization and statistics.",
                "Built with Angular and Django; optimized reporting tools for large datasets.",
                "Re-engaged on the platform after cross-functional experience in extensions and SaaS.",
            ],
        },
        {
            id: "browser-ext",
            company: "Codefrost",
            role: "Software Engineer",
            period: "Nov 2024 – Oct 2025",
            tag: "Browser Extension",
            color: "violet",
            points: [
                "Built and maintained a cross-platform browser extension using SvelteKit and MongoDB.",
                "Focused on seamless browser integration, DOM manipulation, and efficient state management.",
                "Resolved complex race conditions and UI inconsistencies across browser environments.",
            ],
        },
        {
            id: "saas-bff",
            company: "Codefrost",
            role: "Software Engineer",
            period: "Jan 2024 – Nov 2024",
            tag: "SaaS & BFF",
            color: "sky",
            points: [
                "Implemented a modular SaaS architecture using Angular and Django.",
                "Introduced Node.js + Express as a Backend-for-Frontend (BFF) layer.",
                "Streamlined data flow between services and improved frontend performance.",
            ],
        },
        {
            id: "data-analytics-1",
            company: "Codefrost",
            role: "Software Engineer",
            period: "Jun 2023 – Jan 2024",
            tag: "Data & Analytics",
            color: "indigo",
            points: [
                "Developed and maintained data-driven web apps for statistics and visualization.",
                "Contributed QA automation: wrote e2e test suites and manual documentation.",
                "Established reliable test coverage across Angular + Django projects.",
            ],
        },
        {
            id: "trainee",
            company: "Codefrost",
            role: "Technical Trainee — SHS Internship",
            period: "Jan 2023 – Jun 2023",
            tag: "Internship",
            color: "emerald",
            points: [
                "Balanced full-time Grade 12 studies while training in professional software workflows.",
                "Gained practical proficiency in Angular and Django through project-based learning.",
                "Contributed to internal tools and laid the foundation for a full-time engineering role.",
            ],
        },
    ];

    const tagColor: Record<string, string> = {
        indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
        sky: "bg-sky-500/10 text-sky-400 border-sky-500/20",
        emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };

    const dotColor: Record<string, string> = {
        indigo: "bg-indigo-500 shadow-indigo-500/50",
        violet: "bg-violet-500 shadow-violet-500/50",
        sky: "bg-sky-500 shadow-sky-500/50",
        emerald: "bg-emerald-500 shadow-emerald-500/50",
    };

    onMount(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        visibleSections = new Set([
                            ...visibleSections,
                            e.target.id,
                        ]);
                    }
                });
            },
            { threshold: 0.1 },
        );
        document
            .querySelectorAll("[data-observe]")
            .forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    });

    function isVisible(id: string) {
        return visibleSections.has(id);
    }
</script>

<svelte:head>
    <title>Mikas James | Full-Stack Software Engineer</title>
</svelte:head>

<section
    id="about"
    data-observe
    class="relative min-h-screen flex items-center justify-center overflow-hidden px-6"
>
    <div
        class="absolute inset-0 bg-[linear-gradient(to_right,#27272a18_1px,transparent_1px),linear-gradient(to_bottom,#27272a18_1px,transparent_1px)] bg-[size:4rem_4rem]"
    ></div>
    <div
        class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-600/8 blur-[120px] pointer-events-none"
    ></div>

    <div class="relative max-w-5xl mx-auto w-full pt-24 pb-16">
        <div
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 mb-8"
        >
            <span class="relative flex h-2 w-2">
                <span
                    class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
                ></span>
                <span
                    class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"
                ></span>
            </span>
            Available for opportunities · Based in Tanza, Cavite, Philippines
        </div>

        <p class="font-mono text-accent-400 text-sm mb-4 tracking-wider">
            Hi, I'm
        </p>

        <h1
            class="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4 leading-[1.05]"
        >
            <span class="text-zinc-50">Mikas James</span><br />
            <span
                class="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent"
            >
                Gamboa Arayata
            </span>
        </h1>

        <p class="text-lg sm:text-xl text-zinc-400 font-medium mb-6">
            Full-Stack Software Engineer
            <span class="text-zinc-600 mx-2">·</span>
            <span class="font-mono text-sm text-zinc-500"
                >3+ yrs @ Codefrost</span
            >
        </p>

        <p class="max-w-2xl text-zinc-400 text-base leading-relaxed mb-10">
            Solving technical bottlenecks — from race conditions in browser
            extensions to UI inconsistencies in data platforms. I build Web/PWA
            solutions with a focus on
            <span class="text-zinc-200 font-medium">AI integration</span> and
            <span class="text-zinc-200 font-medium">software reliability</span>.
        </p>

        <div class="flex flex-wrap gap-4">
            <a
                href="https://github.com/Mikasjames"
                target="_blank"
                rel="noopener noreferrer"
                id="hero-github-link"
                class="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-medium hover:bg-zinc-800 hover:border-zinc-700 transition-all duration-200 group"
            >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
                    />
                </svg>
                GitHub
                <svg
                    class="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                </svg>
            </a>
            <a
                href="mailto:mikasjames@gmail.com"
                id="hero-email-link"
                class="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-accent-500/10 border border-accent-500/30 text-accent-400 text-sm font-medium hover:bg-accent-500/20 hover:border-accent-400/50 transition-all duration-200"
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
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                </svg>
                mikasjames@gmail.com
            </a>
        </div>

        <div
            class="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40"
        >
            <span
                class="text-xs font-mono text-zinc-500 tracking-widest uppercase"
                >scroll</span
            >
            <div
                class="w-px h-10 bg-gradient-to-b from-zinc-500 to-transparent"
            ></div>
        </div>
    </div>
</section>

<section id="experience" class="py-24 px-6">
    <div class="max-w-5xl mx-auto">
        <div
            id="exp-header"
            data-observe
            class="mb-16 transition-all duration-700 {isVisible('exp-header')
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'}"
        >
            <p
                class="font-mono text-accent-400 text-xs tracking-widest uppercase mb-3"
            >
                02. Work history
            </p>
            <h2 class="text-3xl sm:text-4xl font-bold text-zinc-50">
                Experience
            </h2>
            <div
                class="mt-4 h-px w-16 bg-gradient-to-r from-accent-500 to-transparent"
            ></div>
        </div>

        <div class="relative">
            <div
                class="absolute left-[7px] md:left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-zinc-700 via-zinc-800 to-transparent"
            ></div>

            <div class="flex flex-col gap-12">
                {#each experience as job, i}
                    <div
                        id={job.id}
                        data-observe
                        class="relative pl-8 md:pl-14 transition-all duration-700 delay-[{i *
                            100}ms] {isVisible(job.id)
                            ? 'opacity-100 translate-y-0'
                            : 'opacity-0 translate-y-6'}"
                    >
                        <div
                            class="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full {dotColor[
                                job.color
                            ]} shadow-[0_0_12px] border-2 border-[#09090b]"
                        ></div>
                        <div
                            class="group rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 md:p-6 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-300"
                        >
                            <div
                                class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4"
                            >
                                <div>
                                    <div
                                        class="flex flex-wrap items-center gap-2 mb-1"
                                    >
                                        <span
                                            class="text-xs font-mono font-medium px-2 py-0.5 rounded border {tagColor[
                                                job.color
                                            ]}"
                                        >
                                            {job.tag}
                                        </span>
                                    </div>
                                    <h3
                                        class="text-zinc-100 font-semibold text-lg leading-tight"
                                    >
                                        {job.role}
                                    </h3>
                                    <p class="text-zinc-500 text-sm mt-0.5">
                                        {job.company}
                                    </p>
                                </div>
                                <span
                                    class="font-mono text-xs text-zinc-500 whitespace-nowrap shrink-0 mt-1 bg-zinc-800/50 px-2.5 py-1 rounded-md"
                                >
                                    {job.period}
                                </span>
                            </div>
                            <ul class="space-y-2">
                                {#each job.points as point}
                                    <li
                                        class="flex gap-3 text-sm text-zinc-400 leading-relaxed"
                                    >
                                        <span
                                            class="text-accent-400 shrink-0 mt-0.5"
                                            >▸</span
                                        >
                                        {point}
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </div>
</section>

<section id="skills" class="py-24 px-6 bg-zinc-900/20">
    <div class="max-w-5xl mx-auto">
        <div
            id="skills-header"
            data-observe
            class="mb-12 transition-all duration-700 {isVisible('skills-header')
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'}"
        >
            <p
                class="font-mono text-accent-400 text-xs tracking-widest uppercase mb-3"
            >
                03. What I work with
            </p>
            <h2 class="text-3xl sm:text-4xl font-bold text-zinc-50">
                Tech Stack
            </h2>
            <div
                class="mt-4 h-px w-16 bg-gradient-to-r from-accent-500 to-transparent"
            ></div>
        </div>

        <div
            id="skills-tabs"
            data-observe
            class="transition-all duration-700 delay-100 {isVisible(
                'skills-tabs',
            )
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'}"
        >
            <div class="flex flex-wrap gap-2 mb-8">
                {#each skillTabs as tab}
                    <button
                        id="skill-tab-{tab.toLowerCase().replace(/\s+/g, '-')}"
                        onclick={() => (activeSkillTab = tab)}
                        class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {activeSkillTab ===
                        tab
                            ? 'bg-accent-500/20 text-accent-400 border border-accent-500/40'
                            : 'text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-700 hover:bg-zinc-800/50'}"
                    >
                        {tab}
                    </button>
                {/each}
            </div>

            <div class="flex flex-wrap gap-3 min-h-[100px]">
                {#each skills[activeSkillTab] as skill}
                    <span
                        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-medium hover:border-zinc-600 hover:text-zinc-100 transition-all duration-200 cursor-default group"
                    >
                        <span
                            class="w-1.5 h-1.5 rounded-full bg-accent-400 group-hover:scale-125 transition-transform duration-200"
                        ></span>
                        {skill}
                    </span>
                {/each}
            </div>
        </div>

        <div
            id="skills-stats"
            data-observe
            class="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 transition-all duration-700 delay-200 {isVisible(
                'skills-stats',
            )
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'}"
        >
            {#each [{ label: "Years Experience", value: "3+" }, { label: "Projects Shipped", value: "10+" }, { label: "Tech Domains", value: "5" }, { label: "Focus Areas", value: "Web · AI · QA" }] as stat}
                <div
                    class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-center hover:border-zinc-700 transition-colors duration-200"
                >
                    <p class="text-2xl font-bold text-zinc-50 mb-1">
                        {stat.value}
                    </p>
                    <p class="text-xs text-zinc-500">{stat.label}</p>
                </div>
            {/each}
        </div>
    </div>
</section>

<section id="contact" class="py-24 px-6">
    <div class="max-w-5xl mx-auto">
        <div
            id="contact-inner"
            data-observe
            class="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/50 p-10 md:p-16 text-center relative overflow-hidden transition-all duration-700 {isVisible(
                'contact-inner',
            )
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'}"
        >
            <div
                class="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-accent-500/10 blur-3xl rounded-full pointer-events-none"
            ></div>

            <p
                class="font-mono text-accent-400 text-xs tracking-widest uppercase mb-4"
            >
                04. Let's connect
            </p>
            <h2 class="text-3xl sm:text-4xl font-bold text-zinc-50 mb-4">
                Get In Touch
            </h2>
            <p class="text-zinc-400 max-w-lg mx-auto leading-relaxed mb-10">
                Whether you have a project in mind, a role to fill, or just want
                to say hello — my inbox is always open.
            </p>

            <div
                class="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
                <a
                    href="mailto:mikasjames@gmail.com"
                    id="contact-email-btn"
                    class="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-accent-500 text-white text-sm font-semibold hover:bg-accent-600 transition-all duration-200 shadow-lg shadow-accent-500/25"
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
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                    </svg>
                    mikasjames@gmail.com
                </a>
                <a
                    href="https://github.com/Mikasjames"
                    target="_blank"
                    rel="noopener noreferrer"
                    id="contact-github-btn"
                    class="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-semibold hover:bg-zinc-700 hover:border-zinc-600 transition-all duration-200"
                >
                    <svg
                        class="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
                        />
                    </svg>
                    GitHub Profile
                </a>
            </div>
        </div>

        <footer
            class="mt-16 pt-8 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600"
        >
            <p class="font-mono">
                <span class="text-accent-400">&gt;_</span> mikas · built with
                <a
                    href="https://kit.svelte.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-zinc-400 transition-colors underline underline-offset-2"
                    >SvelteKit</a
                >
                &
                <a
                    href="https://tailwindcss.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-zinc-400 transition-colors underline underline-offset-2"
                    >Tailwind CSS</a
                >
            </p>
            <p>
                © {new Date().getFullYear()} Mikas James Gamboa Arayata. All rights
                reserved.
            </p>
        </footer>
    </div>
</section>
