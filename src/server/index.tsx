import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import axios from "axios";
import { Elysia, t } from "elysia";
import download from "./download";

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

const isProduction = process.env.NODE_ENV === "production";
const htmlTemplate = isProduction
	? await Bun.file("dist/index.html").text()
	: "";

const app = new Elysia();

if (isProduction) {
	app.use(
		staticPlugin({
			assets: "./dist/",
			prefix: "",
			alwaysStatic: false,
			noCache: true,
		}),
	);
}

app
	.use(cors())
	.use(download)
	.get(
		"/",
		async ({ request, set, query: { b: beatmapId } }) => {
			try {
				let metaTags = "";

				if (beatmapId) {
					try {
						const { data: beatmapData } = await axios.get(
							`https://api.try-z.net/b/${beatmapId[0]}`,
							{ timeout: 3000 },
						);
						const data = {
							artist: escapeHtml(beatmapData.beatmapset.artist ?? ""),
							title: escapeHtml(beatmapData.beatmapset.title ?? ""),
							cover: encodeURI(beatmapData.beatmapset.covers["card@2x"] ?? ""),
							creator: escapeHtml(beatmapData.beatmapset.creator ?? ""),
							difficulty: escapeHtml(beatmapData.version ?? ""),
						};
						metaTags = `
							<meta property="og:title" content="${data.artist} - ${data.title} | JoSu! - osu! Beatmap Viewer" />
							<meta name="twitter:title" content="${data.artist} - ${data.title} | JoSu! - osu! Beatmap Viewer" />
							<meta property="og:description" content="Difficulty: ${data.difficulty} - Mapset by ${data.creator}" />
							<meta name="twitter:description" content="Difficulty: ${data.difficulty} - Mapset by ${data.creator}" />
							<meta property="og:image" content="${data.cover}" />
							<meta name="twitter:image" content="${data.cover}" />
						`;
					} catch {
						console.log("Cannot find beatmap");
					}
				}

				if (!metaTags) {
					metaTags = `
						<meta property="og:title" content="JoSu! - osu! Beatmap Viewer" />
						<meta name="twitter:title" content="JoSu! - osu! Beatmap Viewer" />
						<meta property="og:description" content="osu! Beatmap Viewer on the Web" />
						<meta name="twitter:description" content="osu! Beatmap Viewer on the Web" />
						<meta property="og:image" content="https://fukutotojido.s-ul.eu/YuVf9ZAd" />
						<meta name="twitter:image" content="https://fukutotojido.s-ul.eu/YuVf9ZAd" />
					`;
				}

				const commonMeta = `
					<meta name="viewport" content="width=device-width, initial-scale=1.0" />
					<link href="https://cdn.jsdelivr.net/npm/remixicon@4.6.0/fonts/remixicon.min.css" rel="stylesheet" />
					<meta property="og:site_name" content="JoSu! | osu! Beatmap Viewer" />
					<meta property="og:type" content="website" />
					<meta name="twitter:card" content="summary_large_image" />
					<title>JoSu!</title>
					${metaTags}
				`;

				// Inject meta tags into the existing built HTML template
				const html = htmlTemplate.includes("</head>")
					? htmlTemplate.replace("</head>", `${commonMeta}</head>`)
					: `<!DOCTYPE html><html lang="en"><head>${commonMeta}</head>${htmlTemplate}</html>`;

				set.headers["content-type"] = "text/html";
				return html;
			} catch (e) {
				console.error(e);
				set.status = 500;
				return "Internal Server Error";
			}
		},
		{
			query: t.Object({
				b: t.Optional(t.Array(t.Number())),
			}),
		},
	)
	.listen({ port: process.env.PORT ?? 8080, hostname: '0.0.0.0' });

console.log(
	`Elysia is running at ${app.server?.hostname}:${app.server?.port} @production=${isProduction}`,
);
