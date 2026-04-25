import type Audio from "@/Audio";
import type BeatmapSet from "@/BeatmapSet";
import type BackgroundConfig from "@/Config/BackgroundConfig";
import { inject } from "@/Context";
import type Background from "@/UI/main/viewer/Background";
import { MessageType, type WorkerPayload } from "./types";

export default class Video {
	worker = new Worker(new URL("./Worker.ts", import.meta.url), {
		type: "module",
	});

	constructor() {
		// Resolve the WASM base against the document directory, not window.location.href.
		//
		// Using location.href breaks two real cases for the iframe embed:
		//   1. Subpaths that point at a file (e.g. ".../josu/index.html") — the
		//      filename ends up in `base`, so the worker fetches
		//      ".../index.html/web-demuxer.wasm" → 404.
		//   2. Hash-routed parents (e.g. "...#/some/route") — the fragment leaks
		//      into the resolved URL.
		//
		// `new URL(".", document.baseURI)` always yields the directory of the
		// current document (honoring any <base href>), so the worker can append
		// "/web-demuxer.wasm" safely. Trailing slashes are trimmed because the
		// worker concatenates with a leading `/`.
		const base = new URL(".", document.baseURI).toString().replace(/\/+$/, "");
		this.worker.postMessage({
			type: MessageType.Init,
			data: base,
		});

		this.worker.addEventListener(
			"message",
			(event: { data: WorkerPayload }) => {
				switch (event.data.type) {
					case MessageType.Frame: {
						if (!inject<BackgroundConfig>("config/background")?.video) {
							(event.data.data as VideoFrame).close();
							break;
						}

						inject<Background>("ui/main/viewer/background")?.updateFrame(
							event.data.data as VideoFrame,
						);

						break;
					}
				}
			},
		);

		inject<BackgroundConfig>("config/background")?.onChange("video", (val) => {
			const audio =
				inject<BeatmapSet>("beatmapset")?.context.consume<Audio>("audio");
			if (!audio) return;

			if (!val) this.stop(audio.currentTime);
			if (val && audio.state === "PLAYING") this.play(audio.currentTime);
		});
	}

	async load(blob: Blob, offset: number) {
		this.worker.postMessage({
			type: MessageType.Load,
			data: blob,
			offset,
		});
	}

	seek(timestamp: number) {
		this.worker.postMessage({
			type: MessageType.Seek,
			data: timestamp,
		});
	}

	play(timestamp: number) {
		this.worker.postMessage({
			type: MessageType.Play,
			data: timestamp,
			playbackRate: inject<BeatmapSet>("beatmapset")?.playbackRate ?? 1,
		});
	}

	stop(timestamp: number) {
		this.worker.postMessage({
			type: MessageType.Stop,
			data: timestamp,
		});
	}

	destroy() {
		this.worker.terminate();
	}
}
