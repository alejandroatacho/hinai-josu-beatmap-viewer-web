import "@pixi/layout";
import { Assets } from "pixi.js";
import type Audio from "./Audio";
import type BeatmapSet from "./BeatmapSet";
import { inject, provide } from "./Context";
import { Game } from "./Game";
import { HINAI_ENVIRONMENT, STORYBOARD_ONLY } from "./Initiator";
import { postToParent } from "./utils";

let _loadingDiff = false;

document.addEventListener("keydown", (event) => {
	const bms = inject<BeatmapSet>("beatmapset");
	const audio = bms?.context.consume<Audio>("audio");

	if (!bms || !audio) return;

	// Skip game shortcuts when focus is in an editable element
	const activeEl = document.activeElement;
	const isEditable =
		activeEl instanceof HTMLElement &&
		(activeEl.matches("input, textarea, select") || activeEl.isContentEditable);
	if (isEditable) return;

	const key = event.key;

	// --- Seek backward / forward ---
	// Default: ArrowLeft / ArrowRight
	// Hinai:   A / D (arrows reserved for diff switching)
	const isSeekBack = HINAI_ENVIRONMENT
		? (key === "a" || key === "A") && !event.ctrlKey && !event.metaKey
		: key === "ArrowLeft";
	const isSeekFwd = HINAI_ENVIRONMENT
		? (key === "d" || key === "D") && !event.ctrlKey && !event.metaKey
		: key === "ArrowRight";

	// --- Play / Pause ---
	// Default: Space
	// Hinai:   P (+ Space still works)
	const isToggle = HINAI_ENVIRONMENT
		? ((key === "p" || key === "P") && !event.ctrlKey && !event.metaKey && !event.altKey) || key === " "
		: key === " ";

	// --- Switch difficulty (Hinai only) ---
	// ArrowLeft / ArrowRight cycle through difficulties
	const isDiffPrev = HINAI_ENVIRONMENT && key === "ArrowLeft";
	const isDiffNext = HINAI_ENVIRONMENT && key === "ArrowRight";

	if (isSeekBack) {
		bms.smoothTick(-1, event.shiftKey, audio?.state === "PLAYING");
		return;
	}

	if (isSeekFwd) {
		bms.smoothTick(1, event.shiftKey, audio?.state === "PLAYING");
		return;
	}

	if (isToggle) {
		event.preventDefault();
		if (event.repeat) return;
		bms.toggle();
		return;
	}

	if (isDiffPrev || isDiffNext) {
		event.preventDefault();
		if (_loadingDiff) return;
		if (!bms.master || bms.difficulties.length <= 1) return;
		const currentIdx = bms.difficulties.indexOf(bms.master);
		const nextIdx = isDiffNext
			? (currentIdx + 1) % bms.difficulties.length
			: (currentIdx - 1 + bms.difficulties.length) % bms.difficulties.length;
		_loadingDiff = true;
		bms.loadMaster(nextIdx).finally(() => {
			_loadingDiff = false;
		});
		return;
	}

	switch (key) {
		case "c":
		case "C": {
			if (!event.ctrlKey) return;
			if (!bms.master) return;

			const selected = [];
			for (const idx of bms.master.container.selected) {
				selected.push(bms.master.objects[idx].object);
			}

			if (!selected.length) return;

			const timestamp = selected[0].startTime;
			const indexes = selected
				.toSorted((a, b) => a.startTime - b.startTime)
				.map((o) => o.currentComboIndex + 1)
				.join(",");

			const m = Math.floor(timestamp / 1000 / 60);
			const s = Math.floor((timestamp - m * 1000 * 60) / 1000);
			const ms = timestamp % 1000;

			navigator.clipboard.writeText(
				`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${ms.toString().padStart(3, "0")} (${indexes})`,
			);
		}
	}
});

document.addEventListener(
	"wheel",
	(e) => {
		if (e.ctrlKey) e.preventDefault();
	},
	{
		capture: true,
		passive: false,
	},
);

for (const ele of document.querySelectorAll(".flyout-toggle")) {
	const parent = ele.parentElement;
	if (!parent) continue;

	const container = parent.querySelector(".flyout");
	if (!container) continue;

	ele.addEventListener("click", (e) => {
		e.stopPropagation();

		if (container.classList.contains("hidden")) {
			container.classList.remove("hidden");
			container.classList.add("showIn");

			return;
		}

		container.classList.toggle("showOut");
		container.classList.toggle("showIn");
	});
}

document.body.addEventListener("click", (e) => {
	const flyouts = document.querySelectorAll(".flyout");

	for (const ele of flyouts) {
		const boundingRect = ele.getBoundingClientRect();
		const isOutBound =
			e.clientX < boundingRect.left ||
			e.clientX > boundingRect.right ||
			e.clientY < boundingRect.top ||
			e.clientY > boundingRect.bottom;
		const isOpen = ele.classList.contains("showIn");

		if (isOpen && isOutBound) {
			e.preventDefault();

			ele.classList.add("showOut");
			ele.classList.remove("showIn");

			return;
		}
	}
});

// ── Embed attribution: small "powered by hinamizawa.ai" badge when iframed ──
// Only renders inside an iframe — standalone josu.hinamizawa.ai stays uncluttered.
// This is the public-embed advertising surface; if it ever becomes a problem,
// embedders can hide it with a CSS overlay on their side.
if (typeof window !== "undefined" && window.parent !== window) {
	const badge = document.createElement("a");
	badge.href = "https://hinamizawa.ai";
	badge.target = "_blank";
	badge.rel = "noopener noreferrer";
	badge.textContent = "powered by hinamizawa.ai";
	badge.style.cssText = [
		"position:fixed",
		"bottom:6px",
		"right:8px",
		"z-index:2147483647",
		"font:11px/1 system-ui,-apple-system,sans-serif",
		"color:rgba(255,255,255,0.5)",
		"background:rgba(0,0,0,0.4)",
		"padding:3px 7px",
		"border-radius:3px",
		"text-decoration:none",
		"pointer-events:auto",
		"backdrop-filter:blur(4px)",
		"-webkit-backdrop-filter:blur(4px)",
		"transition:color 0.15s",
	].join(";");
	badge.addEventListener("mouseenter", () => { badge.style.color = "rgba(255,255,255,0.9)"; });
	badge.addEventListener("mouseleave", () => { badge.style.color = "rgba(255,255,255,0.5)"; });
	if (document.body) {
		document.body.appendChild(badge);
	} else {
		document.addEventListener("DOMContentLoaded", () => document.body.appendChild(badge), { once: true });
	}
}

// ── Storyboard-only mode: hide unnecessary DOM elements ──
if (STORYBOARD_ONLY) {
	document.querySelector("#topBar")?.classList.add("hidden");
	document.querySelector("#settings")?.classList.add("hidden");
	document.querySelector("#splash")?.classList.add("hidden");
	document.querySelector("#diffsContainerWrapper")?.classList.add("hidden");
	document.body.style.background = "black";
}

// ── postMessage API for iframe embedding (public) ──
// Origin allowlist intentionally absent — see utils.ts for the safety rationale.
// `event.source === window.parent` stays as cheap defense against same-page
// non-parent windows (popups/openers) trying to drive us.
window.addEventListener("message", (event) => {
	if (window.parent === window) return;
	if (event.source !== window.parent) return;

	const data = event.data;
	if (!data || typeof data.type !== "string") return;

	const bms = inject<BeatmapSet>("beatmapset");
	const audio = bms?.context.consume<Audio>("audio");

	switch (data.type) {
		case "PLAY":
			if (bms && audio && audio.state !== "PLAYING") bms.toggle();
			break;
		case "PAUSE":
			if (bms && audio && audio.state === "PLAYING") bms.toggle();
			break;
		case "CLOSE":
			bms?.destroy();
			postToParent({ type: "CLOSED" }, event.origin);
			break;
	}
});

(async () => {
	try {
		await navigator.wakeLock.request("screen");
	} catch {
		// the wake lock request fails - usually system related, such being low on battery
	}

	await Promise.all([
		Assets.load({ src: "./assets/metadata.png", parser: "texture" }),
		Assets.load({ src: "./assets/back.png", parser: "texture" }),
		Assets.load({ src: "./assets/play.png", parser: "texture" }),
		Assets.load({ src: "./assets/pause.png", parser: "texture" }),
		Assets.load({ src: "./assets/next.png", parser: "texture" }),
		Assets.load({ src: "./assets/maximize.png", parser: "texture" }),
		Assets.load({ src: "./assets/x.png", parser: "texture" }),
	]);

	const game = provide("game", new Game());
	await game.init();

	// Notify parent iframe that josu is ready
	postToParent({ type: "READY" });
})();
