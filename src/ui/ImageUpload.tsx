import { useState } from "react";
import { api } from "../cloud/api";
import { useCloud } from "../cloud/store";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

/** Upload button for an image field: sends the file to S3 and hands back its URL. */
export function ImageUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
	const user = useCloud((s) => s.user);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	if (!user) return <p className="hint">Sign in via ☁ Cloud to upload images.</p>;

	const upload = async (file: File | undefined) => {
		if (!file) return;
		setError("");
		if (!ACCEPT.split(",").includes(file.type)) return setError("Use a PNG, JPEG, WebP or GIF.");
		if (file.size > MAX_BYTES) return setError("Images must be 5 MB or smaller.");
		setBusy(true);
		try {
			onUploaded(await api.uploadImage(file));
		} catch (e) {
			setError(e instanceof Error ? e.message : "Upload failed");
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<div className="prop-upload">
				<label className="file-btn">
					{busy ? "Uploading…" : "Upload image…"}
					<input
						type="file"
						accept={ACCEPT}
						hidden
						disabled={busy}
						onChange={(e) => {
							upload(e.target.files?.[0]);
							e.target.value = "";
						}}
					/>
				</label>
			</div>
			{error && <p className="cloud-error">{error}</p>}
		</>
	);
}
