import { useEffect, useMemo, useState } from "react";
import { useStore } from "../model/store";
import { generate, type GeneratedFile } from "../codegen/generate";
import { formatFiles } from "../codegen/format";

export function CodeView() {
	const doc = useStore((s) => s.doc);
	const raw = useMemo(() => generate(doc), [doc]);
	const [files, setFiles] = useState<GeneratedFile[]>(raw);
	const [active, setActive] = useState(0);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		let live = true;
		formatFiles(raw).then((f) => live && setFiles(f));
		return () => {
			live = false;
		};
	}, [raw]);

	const file = files[Math.min(active, files.length - 1)];
	const copy = async () => {
		await navigator.clipboard.writeText(file.content);
		setCopied(true);
		setTimeout(() => setCopied(false), 1200);
	};
	const download = () => {
		const url = URL.createObjectURL(new Blob([file.content], { type: "text/plain" }));
		const a = Object.assign(document.createElement("a"), { href: url, download: file.path });
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="code-view">
			<div className="code-tabs">
				{files.map((f, i) => (
					<button key={f.path} className={i === active ? "active" : ""} onClick={() => setActive(i)}>
						{f.path}
					</button>
				))}
				<span className="spacer" />
				<button onClick={copy}>{copied ? "Copied" : "Copy"}</button>
				<button onClick={download}>Download</button>
			</div>
			<pre className="code">
				<code>{file.content}</code>
			</pre>
		</div>
	);
}
