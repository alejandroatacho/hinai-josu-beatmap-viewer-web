import ConfigSection from "./ConfigSection";

export type Mirror = {
	name: string;
	urlTemplate: string;
};

export type MirrorProps = {
	mirror?: Mirror;
};

// Hinai Beatmap Mirror base URL — used for v2 josu optimization endpoints
export const HINAI_MIRROR_BASE = "https://mirror.hinamizawa.ai";
export const HINAI_MIRROR_NAME = "Hinai";

/** Check if the currently selected mirror is Hinai Beatmap Mirror */
export function isHinaiMirror(mirror: Mirror): boolean {
	return mirror.urlTemplate.includes("mirror.hinamizawa.ai");
}

export default class MirrorConfig extends ConfigSection {
	constructor(defaultOptions?: MirrorProps) {
		super();

		this.loadEventListeners();

		if (!defaultOptions) return;

		if (defaultOptions.mirror !== undefined) {
			this.mirror = defaultOptions.mirror;
		}
	}

	private _mirror = {
		name: HINAI_MIRROR_NAME,
		urlTemplate: "https://mirror.hinamizawa.ai/d/$setId?proxy=true",
	};
	get mirror() {
		return this._mirror;
	}
	set mirror(val: Mirror) {
		this._mirror = { ...val, urlTemplate: this.migrate(val) };

		for (const element of document.querySelectorAll<HTMLInputElement>(
			"[name=beatmapMirror]",
		)) {
			element.checked = element.value === val.name;
		}

		this.emitChange("mirror", val);
	}

	loadEventListeners() {
		for (const element of document.querySelectorAll<HTMLInputElement>(
			"[name=beatmapMirror]",
		)) {
			element.addEventListener("change", (event) => {
				const name = (event.target as HTMLInputElement).value;
				const url = (event.target as HTMLInputElement).dataset.url;

				if (!url) return;
				this.mirror = {
					name,
					urlTemplate: url,
				};
			});
		}
	}

	jsonify(): MirrorProps {
		return {
			mirror: this.mirror,
		};
	}

	migrate(val: Mirror) {
		switch (val.name) {
			case "Hinamizawa":
			case "mirror.hinamizawa.ai":
			case "Hinai": {
				return "https://mirror.hinamizawa.ai/d/$setId?proxy=true";
			}
			case "Nerinyan": {
				return "https://api.nerinyan.moe/v2/d/$setId";
			}
			default: {
				return val.urlTemplate;
			}
		}
	}
}
