import { useEffect, useMemo, useState } from "react";
import { useStore } from "../model/store";
import { generate, type GeneratedFile } from "../codegen/generate";
import { formatFiles } from "../codegen/format";

const download = (blob: Blob, name: string) => {
	const url = URL.createObjectURL(blob);
	Object.assign(document.createElement("a"), { href: url, download: name }).click();
	URL.revokeObjectURL(url);
};

export function CodeView() {
	const doc = useStore((s) => s.doc);
	const raw = useMemo(() => generate(doc), [doc]);
	const [files, setFiles] = useState<GeneratedFile[]>(raw);
	const [html, setHtml] = useState<string | null>(null);
	const [active, setActive] = useState(0);
	const [copied, setCopied] = useState(false);
	const file = files[Math.min(active, files.length - 1)];

	useEffect(() => {
		let live = true;
		formatFiles(raw).then((f) => live && setFiles(f));
		return () => {
			live = false;
		};
	}, [raw]);

	// Shiki is loaded lazily so it stays out of the main bundle.
	useEffect(() => {
		let live = true;
		import("shiki")
			.then(({ codeToHtml }) =>
				codeToHtml(file.content, { lang: file.language, theme: "github-dark" }),
			)
			.then((h) => live && setHtml(h))
			.catch(() => live && setHtml(null));
		return () => {
			live = false;
		};
	}, [file]);

	const copy = async () => {
		await navigator.clipboard.writeText(file.content);
		setCopied(true);
		setTimeout(() => setCopied(false), 1200);
	};

	return (
		<div className="code-view">
			<div className="code-tabs">
				{files.map((f, i) => (
					<button
						key={f.path}
						className={i === active ? "active" : ""}
						onClick={() => setActive(i)}
					>
						{f.path}
					</button>
				))}
				<span className="spacer" />
				<button onClick={copy}>{copied ? "Copied" : "Copy"}</button>
				<button
					onClick={() => download(new Blob([file.content], { type: "text/plain" }), file.path)}
				>
					Download file
				</button>
			</div>
			{html ? (
				<div className="code" dangerouslySetInnerHTML={{ __html: html }} />
			) : (
				<pre className="code">
					<code>{file.content}</code>
				</pre>
			)}
		</div>
	);
}
