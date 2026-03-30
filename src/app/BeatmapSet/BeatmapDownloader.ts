import ky from "ky";
import type Loading from "@/UI/loading";
import type MirrorConfig from "../Config/MirrorConfig";
import { HINAI_MIRROR_BASE, isHinaiMirror } from "../Config/MirrorConfig";
import { inject } from "../Context";

type BeatmapData = {
	beatmapset_id: number;
	id: number;
};

export enum IDType {
	BEATMAP_SET = "s",
	BEATMAP = "b",
}

const sanitizeID = (id: string) => {
	if (!/^[0-9]+$/g.test(id)) {
		return null;
	}

	return id;
};

export function processID(id: string): {
	id: string;
	type: IDType;
} | null {
	if (/^[0-9]+$/g.test(id)) return { id, type: IDType.BEATMAP };

	try {
		const url = new URL(id);

		if (url.hostname !== "osu.ppy.sh") {
			return null;
		}

		const params = url.pathname.split("/");
		if (!params[1] || !params[2]) return null;

		switch (params[1]) {
			case "beatmapsets": {
				if (!url.hash) {
					const id = sanitizeID(params[2]);
					return id ? { id, type: IDType.BEATMAP_SET } : null;
				}

				const [_, strId] = url.hash.split("/");
				if (!strId) {
					const id = sanitizeID(params[2]);
					return id ? { id, type: IDType.BEATMAP_SET } : null;
				}

				const id = sanitizeID(strId);
				return id ? { id, type: IDType.BEATMAP } : null;
			}
			case "s": {
				const id = sanitizeID(params[2]);
				return id ? { id, type: IDType.BEATMAP_SET } : null;
			}
			case "beatmaps":
			case "b": {
				const id = sanitizeID(params[2]);
				return id ? { id, type: IDType.BEATMAP } : null;
			}
		}

		return null;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Hinai fast path — uses /api/v2/josu/ endpoints (DuckDB, ~3ms)
// ---------------------------------------------------------------------------

async function getBeatmapsetIdFromHinai(beatmapId: string): Promise<number | null> {
	try {
		inject<Loading>("ui/loading")?.setText("Resolving via Hinai...");
		const data = await ky
			.get(`${HINAI_MIRROR_BASE}/api/v2/josu/resolve/${beatmapId}`)
			.json<{ beatmapset_id: number }>();
		return data.beatmapset_id ?? null;
	} catch {
		return null;
	}
}

async function fetchBundleFromHinai(
	beatmapsetId: string | number,
): Promise<Blob | null> {
	try {
		inject<Loading>("ui/loading")?.setText("Downloading from Hinai...");
		const blob = await ky
			.get(`${HINAI_MIRROR_BASE}/api/v2/josu/bundle/${beatmapsetId}`, {
				onDownloadProgress(progressEvent) {
					inject<Loading>("ui/loading")?.setText(
						`Downloading from Hinai: ${(100 * (progressEvent.percent ?? 0)).toFixed(0)}%`,
					);
				},
			})
			.blob();
		return blob;
	} catch {
		return null;
	}
}

// Prefetched audio promises — keyed by beatmapset ID to prevent cross-map races.
// Consumed by BeatmapSet.loadAudio() when audio isn't in the extracted resources.
const _prefetchedAudio = new Map<string, Promise<Blob | null>>();

function prefetchAudio(beatmapsetId: string | number) {
	const key = String(beatmapsetId);
	_prefetchedAudio.set(
		key,
		fetch(`${HINAI_MIRROR_BASE}/api/v2/josu/audio/${beatmapsetId}`)
			.then((r) => (r.ok ? r.blob() : null))
			.catch(() => null),
	);
}

/** Get prefetched audio blob for a specific beatmapset. Clears entry after consumption. */
export async function consumePrefetchedAudio(
	beatmapsetId: string | number,
): Promise<Blob | null> {
	const key = String(beatmapsetId);
	const promise = _prefetchedAudio.get(key);
	if (!promise) return null;
	const result = await promise;
	_prefetchedAudio.delete(key);
	return result;
}

// ---------------------------------------------------------------------------
// Default path — uses try-z.net + mirror cascade (external, slower)
// ---------------------------------------------------------------------------

async function getBeatmapsetId(beatmapId: string) {
	try {
		if (!/\d+/g.test(beatmapId)) throw new Error("beatmapId is not a number!");
		inject<Loading>("ui/loading")?.setText("Getting beatmapsetId...");
		const { beatmaps }: { beatmaps: BeatmapData[] } = await ky
			.get(`https://api.try-z.net/beatmaps?ids=${beatmapId}`)
			.json();

		if (beatmaps.length === 0) return null;
		return beatmaps[0]?.beatmapset_id ?? null;
	} catch (e) {
		console.error(e);
		return null;
	}
}

async function getBeatmapsetIdFromHash(hash: string) {
	try {
		if (!/\d+[a-f]+/g.test(hash))
			throw new Error("checksum is not in valid format!");
		inject<Loading>("ui/loading")?.setText("Getting beatmapsetId...");
		const beatmap: BeatmapData = await ky
			.get(`https://api.try-z.net/b/h/${hash}`)
			.json();

		return beatmap.beatmapset_id ?? null;
	} catch (e) {
		console.error(e);
		return null;
	}
}

// ---------------------------------------------------------------------------
// Public API — auto-selects Hinai fast path or default based on mirror config
// ---------------------------------------------------------------------------

export async function getBeatmapFromId(
	beatmapId: string,
	beatmapSetId?: string,
) {
	const mirrorConfig = inject<MirrorConfig>("config/mirror");
	const useHinai = mirrorConfig && isHinaiMirror(mirrorConfig.mirror);

	// Resolve beatmapset ID via Hinai (DuckDB ~3ms) or try-z.net (external ~350ms)
	let beatmapsetId: string | number | null = beatmapSetId ?? null;
	if (!beatmapsetId) {
		if (useHinai) {
			beatmapsetId = await getBeatmapsetIdFromHinai(beatmapId);
			// Fall back to try-z.net if Hinai resolver misses (e.g. map not yet crawled)
			if (!beatmapsetId) beatmapsetId = await getBeatmapsetId(beatmapId);
		} else {
			beatmapsetId = await getBeatmapsetId(beatmapId);
		}
	}

	if (!beatmapsetId)
		throw new Error(
			`Map(set) with id ${beatmapId ?? beatmapSetId} does not exist!!!`,
		);

	// Hinai: start audio prefetch in parallel, then download lightweight bundle
	if (useHinai) {
		prefetchAudio(beatmapsetId); // fires immediately, consumed by loadAudio()
		const bundle = await fetchBundleFromHinai(beatmapsetId);
		if (bundle) return bundle;
		// Fall through to full .osz if bundle fails
	}

	return await fetchBlobFromMirror(beatmapsetId);
}

export async function getBeatmapFromHash(hash: string) {
	const beatmapsetId = await getBeatmapsetIdFromHash(hash);
	if (!beatmapsetId) throw new Error(`Map with hash ${hash} does not exist!!!`);

	return await fetchBlobFromMirror(beatmapsetId);
}

const fetchBlobFromMirror = async (
	beatmapsetId: string | number,
	retry = 0,
) => {
	const mirrorConfig = inject<MirrorConfig>("config/mirror");
	if (!mirrorConfig) throw new Error("Mirror Config not initialized yet!!!");

	const {
		mirror: { urlTemplate, name: mirrorName },
	} = mirrorConfig;

	// Get mirrors from DOM radio buttons (standalone mode)
	const radioMirrors = [
		...document.querySelectorAll<HTMLInputElement>("[name=beatmapMirror]"),
	]
		.map((ele) => ({
			url: ele.dataset.url,
			rank: ele.dataset.rank as string,
			name: ele.value,
		}))
		.toSorted((a, b) => +a.rank - +b.rank);

	// Embed mode: no radio buttons exist — use configured mirror directly
	const allMirrors = radioMirrors.length > 0
		? radioMirrors
		: [{ url: urlTemplate, rank: "0", name: mirrorName }];

	const configIndex = Math.max(0, allMirrors.findIndex(
		(entry) => entry.url === urlTemplate.trim(),
	));
	const sortedMirrors = [
		allMirrors[configIndex],
		...allMirrors.slice(0, configIndex),
		...allMirrors.slice(configIndex + 1),
	];

	const selectedMirror = sortedMirrors[retry % allMirrors.length];
	inject<Loading>("ui/loading")?.setText(
		retry === 0
			? `Downloading with ${selectedMirror.name}`
			: `Retrying with ${selectedMirror.name}`,
	);

	try {
		inject<Loading>("ui/loading")?.setText("Getting beatmap...");
		const blob = await ky
			.get(
				selectedMirror.url?.replaceAll("$setId", beatmapsetId.toString()) ?? "",
				{
					headers: { Accept: "application/x-osu-beatmap-archive" },
					onDownloadProgress(progressEvent) {
						inject<Loading>("ui/loading")?.setText(
							retry === 0
								? `Downloading with ${selectedMirror.name}: ${(100 * (progressEvent.percent ?? 0)).toFixed(2)}%`
								: `Retrying with ${selectedMirror.name}: ${(100 * (progressEvent.percent ?? 0)).toFixed(2)}%`,
						);
					},
				},
			)
			.blob();

		return blob;
	} catch (e) {
		console.error(e);
		if (retry >= allMirrors.length) return null;
		return await fetchBlobFromMirror(beatmapsetId, retry + 1);
	}
};

export async function getBeatmapFromExternalUrl(url: string) {
	try {
		inject<Loading>("ui/loading")?.setText("Getting beatmap...");

		const formData = new FormData();
		formData.append("url", url);
		const blob = await ky
			.post(`./api/download`, {
				body: formData,
				onDownloadProgress(progressEvent) {
					inject<Loading>("ui/loading")?.setText(
						`Downloading map: ${(100 * (progressEvent.percent ?? 0)).toFixed(2)}%`,
					);
				},
			})
			.blob();

		return blob;
	} catch (e) {
		console.error(e);
		return null;
	}
}
