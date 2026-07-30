<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { login, getCurrentUser } from "$lib/firebase/auth";
	import GridBackground from "$lib/components/GridBackground.svelte";
	import Spinner from "$lib/components/Spinner.svelte";
	import AppButton from "$lib/components/AppButton.svelte";

	let email = $state("");
	let password = $state("");
	let error = $state("");
	let loading = $state(false);
	let checkingAuth = $state(true);

	onMount(async () => {
		const user = await getCurrentUser();
		if (user) {
			goto("/admin/");
		} else {
			checkingAuth = false;
		}
	});

	async function handleLogin(e: Event) {
		e.preventDefault();
		error = "";
		loading = true;
		try {
			await login(email, password);
			goto("/admin/");
		} catch (err: unknown) {
			const msg =
				err instanceof Error
					? err.message
					: "Login failed. Please try again.";
			if (
				msg.includes("invalid-credential") ||
				msg.includes("wrong-password") ||
				msg.includes("user-not-found")
			) {
				error = "Invalid email or password.";
			} else if (msg.includes("too-many-requests")) {
				error = "Too many attempts. Please try again later.";
			} else {
				error = msg;
			}
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Admin Login · Mikas James</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if checkingAuth}
	<div class="min-h-screen bg-[#09090b] flex items-center justify-center">
		<Spinner size="lg" color="accent" />
	</div>
{:else}
	<div
		class="min-h-screen bg-[#09090b] flex items-center justify-center px-4"
	>
		<GridBackground opacity="3" />

		<div class="relative w-full max-w-sm">
			<div
				class="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-accent-600/20 rounded-full blur-3xl pointer-events-none"
			></div>

			<div
				class="relative bg-surface-900/80 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-8 shadow-2xl shadow-black/40"
			>
				<div class="mb-8 text-center">
					<span
						class="font-mono text-accent-400 text-xs tracking-widest uppercase"
						>&gt;_ mikas</span
					>
					<h1 class="mt-2 text-xl font-semibold text-zinc-100">
						Admin Access
					</h1>
					<p class="mt-1 text-sm text-zinc-500">
						Sign in to manage your content
					</p>
				</div>

				<form onsubmit={handleLogin} class="space-y-4" id="login-form">
					<div class="space-y-1.5">
						<label
							for="email"
							class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
						>
							Email
						</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							required
							autocomplete="email"
							placeholder="you@example.com"
							class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
						/>
					</div>

					<div class="space-y-1.5">
						<label
							for="password"
							class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
						>
							Password
						</label>
						<input
							id="password"
							type="password"
							bind:value={password}
							required
							autocomplete="current-password"
							placeholder="••••••••"
							class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
						/>
					</div>

					{#if error}
						<div
							class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
						>
							<svg
								class="w-4 h-4 shrink-0"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							{error}
						</div>
					{/if}

					<AppButton id="login-submit-btn" variant="primary" size="lg" type="submit" disabled={loading} loading={loading}>
						{loading ? "Signing in…" : "Sign In"}
					</AppButton>
				</form>
			</div>
		</div>
	</div>
{/if}
