import ky from "ky";
import type { Resource } from "./ZipHandler";

// ──────────────────────────────────────────────────────────────────────────────
// CUSTOM DEFAULT SKIN — When true, loads Hinamizawa's skin as the default.
// Default: false (upstream-safe). Set VITE_CUSTOM_DEFAULT_SKIN=true at build
// time to enable (e.g. in Dockerfile). Skin files in public/skinning/hinamizawa/.
// ──────────────────────────────────────────────────────────────────────────────
export const CUSTOM_DEFAULT_SKIN = import.meta.env.VITE_CUSTOM_DEFAULT_SKIN === "true";

// ──────────────────────────────────────────────────────────────────────────────
// HINAI ENVIRONMENT — Enables Hinamizawa-specific customizations (key remaps,
// UI tweaks) without breaking upstream. Same pattern: default false, override
// via VITE_HINAI_ENVIRONMENT=true build arg in K8s.
// ──────────────────────────────────────────────────────────────────────────────
export const HINAI_ENVIRONMENT = import.meta.env.VITE_HINAI_ENVIRONMENT === "true";

// Shared helper — fetches skin files and returns a resource map.
// Silently skips files that fail to load (e.g. missing assets).
async function loadSkinResources(
	skinPath: string,
	filenames: string[],
): Promise<Map<string, Resource>> {
	const resources = new Map<string, Resource>();
	await Promise.all(
		filenames.map(async (filename) => {
			try {
				const data = await ky.get<Blob>(`${skinPath}${filename}`).blob();
				resources.set(filename, data);
			} catch {
				return;
			}
		}),
	);
	return resources;
}

function buildHitSounds(samples: string[]) {
	return samples.flatMap((hitSample) =>
		[
			"hitclap",
			"hitfinish",
			"hitnormal",
			"hitwhistle",
			"sliderslide",
			"slidertick",
			"sliderwhistle",
		].map((hitSound) => `${hitSample}-${hitSound}.wav`),
	);
}

export async function getHinamizawaSkin() {
	const defaults = [...Array(10)].map((_, idx) => `default-${idx}.png`);
	return loadSkinResources("./skinning/hinamizawa/", [
		"approachcircle.png",
		...defaults,
		...buildHitSounds(["drum", "normal"]),
		"cursor.png",
		"cursortrail.png",
		"followpoint.png",
		"hit300.png",
		"hit100.png",
		"hit50.png",
		"hit0.png",
		"hitcircle.png",
		"hitcircleoverlay.png",
		"skin.ini",
		"sliderb0.png",
		"sliderfollowcircle.png",
		"reversearrow.png",
		"sliderscorepoint.png",
		"sliderstartcircle.png",
		"sliderstartcircleoverlay.png",
		"sliderendcircle.png",
		"spinner-approachcircle.png",
		"spinner-circle.png",
		"spinner-background.png",
		"spinner-clear.png",
		"spinner-middle.png",
		"spinner-middle2.png",
		"spinner-top.png",
		"spinner-glow.png",
		"combobreak.wav",
	]);
}

export async function getArgon() {
	const defaults = [...Array(10)].map((_, idx) => `default-${idx}@2x.png`);
	return loadSkinResources("./skinning/argon/", [
		...defaults,
		...buildHitSounds(["drum", "normal", "soft"]),
		"followpoint.png",
		"timelinehitcircle@2x.png",
		"hit300@2x.png",
		"hit100@2x.png",
		"hit50@2x.png",
		"hit0@2x.png",
		"hitcircle@2x.png",
		"hitcircleflash@2x.png",
		"hitcircleglow@2x.png",
		"hitcircleoverlay@2x.png",
		"hitcircleselect@2x.png",
		"sliderb@2x.png",
		"sliderb-nd@2x.png",
		"sliderfollowcircle@2x.png",
		"reversearrow@2x.png",
		"repeat-edge-piece@2x.png",
		"sliderendcircle.png",
		"sliderstartcircle@2x.png",
		"sliderscorepoint@2x.png",
		"spinner-approachcircle@2x.png",
		"spinner-bottom@2x.png",
		"skin.ini",
	]);
}

export async function getDefaultLegacy() {
	const defaults = [...Array(10)].map((_, idx) => `default-${idx}@2x.png`);
	return loadSkinResources("./skinning/legacy/", [
		"approachcircle@2x.png",
		...defaults,
		...buildHitSounds(["drum", "normal", "soft"]),
		"cursor@2x.png",
		"cursortrail.png",
		"followpoint@2x.png",
		"hit300@2x.png",
		"hit100@2x.png",
		"hit50@2x.png",
		"hit0@2x.png",
		"hitcircle@2x.png",
		"hitcircleoverlay@2x.png",
		"hitcircleselect@2x.png",
		"skin.ini",
		"sliderb0@2x.png",
		"sliderb1@2x.png",
		"sliderb2@2x.png",
		"sliderb3@2x.png",
		"sliderb4@2x.png",
		"sliderb5@2x.png",
		"sliderb6@2x.png",
		"sliderb7@2x.png",
		"sliderb8@2x.png",
		"sliderb9@2x.png",
		"sliderb-nd@2x.png",
		"sliderb-spec@2x.png",
		"sliderfollowcircle@2x.png",
		"reversearrow@2x.png",
		"sliderscorepoint@2x.png",
		"spinner-approachcircle@2x.png",
		"spinner-bottom@2x.png",
	]);
}

export async function getYugen() {
	const defaults = [...Array(10)].map((_, idx) => `default-${idx}@2x.png`);
	return loadSkinResources("./skinning/yugen/", [
		"approachcircle.png",
		"cursor@2x.png",
		"cursortrail.png",
		...defaults,
		...buildHitSounds(["drum", "normal", "soft"]),
		"followpoint@2x.png",
		"followpoint-0.png",
		"followpoint-1.png",
		"followpoint-2.png",
		"hit300.png",
		"hit100.png",
		"hit50.png",
		"hit0.png",
		"hitcircle@2x.png",
		"hitcircleoverlay@2x.png",
		"skin.ini",
		"sliderb0@2x.png",
		"sliderfollowcircle@2x.png",
		"reversearrow@2x.png",
		"sliderscorepoint.png",
		"spinner-approachcircle@2x.png",
		"spinner-bottom@2x.png",
	]);
}
