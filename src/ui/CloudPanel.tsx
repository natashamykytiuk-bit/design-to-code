import { useEffect, useState, type FormEvent } from "react";
import { useStore } from "../model/store";
import { api, ApiError, type DesignSummary } from "../cloud/api";
import { AuthError, confirmSignUp, resendCode, signIn, signUp } from "../cloud/auth";
import { cloudMode } from "../cloud/config";
import { useCloud } from "../cloud/store";

const errMsg = (e: unknown) =>
	e instanceof AuthError || e instanceof ApiError || e instanceof Error
		? e.message
		: "Something went wrong";

/** Sign in / sign up / confirm-email forms (Cognito). */
function AuthForms() {
	const setUser = useCloud((s) => s.setUser);
	const [step, setStep] = useState<"signin" | "signup" | "confirm">("signin");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [info, setInfo] = useState("");

	const run = (fn: () => Promise<void>) => async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError("");
		setInfo("");
		try {
			await fn();
		} catch (err) {
			if (err instanceof AuthError && err.code === "UserNotConfirmedException") {
				setStep("confirm");
				setInfo("Enter the code we emailed you to finish signing up.");
			} else setError(errMsg(err));
		} finally {
			setBusy(false);
		}
	};

	const doSignIn = run(async () => {
		const s = await signIn(email.trim(), password);
		setUser(s.email);
	});
	const doSignUp = run(async () => {
		await signUp(email.trim(), password);
		setStep("confirm");
		setInfo("We emailed you a verification code.");
	});
	const doConfirm = run(async () => {
		await confirmSignUp(email.trim(), code.trim());
		const s = await signIn(email.trim(), password);
		setUser(s.email);
	});

	const emailField = (
		<label className="field">
			<span>Email</span>
			<input
				type="email"
				autoComplete="email"
				required
				value={email}
				onChange={(e) => setEmail(e.target.value)}
			/>
		</label>
	);
	const passwordField = (
		<label className="field">
			<span>Password</span>
			<input
				type="password"
				autoComplete={step === "signup" ? "new-password" : "current-password"}
				required
				minLength={8}
				value={password}
				onChange={(e) => setPassword(e.target.value)}
			/>
		</label>
	);

	return (
		<>
			{step === "signin" && (
				<form onSubmit={doSignIn} className="cloud-form">
					{emailField}
					{passwordField}
					<button type="submit" className="primary" disabled={busy}>
						{busy ? "Signing in…" : "Sign in"}
					</button>
					<p className="hint">
						No account?{" "}
						<button type="button" className="link" onClick={() => setStep("signup")}>
							Create one
						</button>
					</p>
				</form>
			)}
			{step === "signup" && (
				<form onSubmit={doSignUp} className="cloud-form">
					{emailField}
					{passwordField}
					<p className="hint">At least 8 characters, with upper and lower case letters and a number.</p>
					<button type="submit" className="primary" disabled={busy}>
						{busy ? "Creating…" : "Create account"}
					</button>
					<p className="hint">
						Have an account?{" "}
						<button type="button" className="link" onClick={() => setStep("signin")}>
							Sign in
						</button>
					</p>
				</form>
			)}
			{step === "confirm" && (
				<form onSubmit={doConfirm} className="cloud-form">
					{emailField}
					{!password && passwordField}
					<label className="field">
						<span>Verification code</span>
						<input
							inputMode="numeric"
							autoComplete="one-time-code"
							required
							value={code}
							onChange={(e) => setCode(e.target.value)}
						/>
					</label>
					<button type="submit" className="primary" disabled={busy}>
						{busy ? "Verifying…" : "Verify and sign in"}
					</button>
					<button
						type="button"
						className="link"
						onClick={() =>
							resendCode(email.trim()).then(
								() => setInfo("Code sent again."),
								(e) => setError(errMsg(e)),
							)
						}
					>
						Resend code
					</button>
				</form>
			)}
			{info && <p className="cloud-info">{info}</p>}
			{error && <p className="cloud-error">{error}</p>}
		</>
	);
}

/** The signed-in user's saved designs, plus save / open / delete. */
function DesignList({ onDone }: { onDone: (msg: string) => void }) {
	const { user, current, setCurrent, signOut } = useCloud();
	const replaceDoc = useStore((s) => s.replaceDoc);
	const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
	const [name, setName] = useState(current?.name ?? "Untitled design");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const refresh = () =>
		api.listDesigns().then(setDesigns, (e) => {
			setError(errMsg(e));
			if (e instanceof ApiError && e.status === 401) signOut();
		});

	useEffect(() => {
		refresh();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const act = async (fn: () => Promise<void>) => {
		setBusy(true);
		setError("");
		try {
			await fn();
		} catch (e) {
			setError(errMsg(e));
		} finally {
			setBusy(false);
		}
	};

	const save = (asNew: boolean) =>
		act(async () => {
			const doc = useStore.getState().doc;
			const n = name.trim() || "Untitled design";
			const d =
				current && !asNew
					? await api.updateDesign(current.id, n, doc)
					: await api.createDesign(n, doc);
			setCurrent({ id: d.id, name: d.name });
			onDone(`Saved “${d.name}” to cloud`);
		});

	const open = (d: DesignSummary) =>
		act(async () => {
			const full = await api.getDesign(d.id);
			replaceDoc(full.doc);
			setCurrent({ id: full.id, name: full.name });
			onDone(`Opened “${full.name}”`);
		});

	const remove = (d: DesignSummary) =>
		act(async () => {
			if (!confirm(`Delete “${d.name}”? This cannot be undone.`)) return;
			await api.deleteDesign(d.id);
			if (current?.id === d.id) setCurrent(null);
			await refresh();
		});

	return (
		<>
			<div className="cloud-user">
				<span className="muted">Signed in as</span> <strong>{user}</strong>
				{cloudMode === "aws" && (
					<button className="link" onClick={signOut}>
						Sign out
					</button>
				)}
			</div>

			<div className="cloud-save">
				<label className="field">
					<span>Design name</span>
					<input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
				</label>
				<div className="row">
					<button className="primary" disabled={busy} onClick={() => save(false)}>
						{current ? "Save" : "Save to cloud"}
					</button>
					{current && (
						<button disabled={busy} onClick={() => save(true)}>
							Save as new
						</button>
					)}
				</div>
			</div>

			<h4>Your designs</h4>
			{designs === null && !error && <p className="hint">Loading…</p>}
			{designs?.length === 0 && <p className="hint">Nothing saved yet.</p>}
			<ul className="cloud-list">
				{designs?.map((d) => (
					<li key={d.id} className={current?.id === d.id ? "current" : ""}>
						<button className="cloud-open" disabled={busy} onClick={() => open(d)}>
							<span>{d.name}</span>
							<span className="muted">{new Date(d.updatedAt).toLocaleString()}</span>
						</button>
						<button
							className="icon-btn"
							title="Delete"
							aria-label={`Delete ${d.name}`}
							disabled={busy}
							onClick={() => remove(d)}
						>
							×
						</button>
					</li>
				))}
			</ul>
			{error && <p className="cloud-error">{error}</p>}
		</>
	);
}

export function CloudPanel({ onClose, flash }: { onClose: () => void; flash: (m: string) => void }) {
	const user = useCloud((s) => s.user);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<div className="modal" role="dialog" aria-modal="true" aria-labelledby="cloud-title">
				<header>
					<h3 id="cloud-title">Cloud</h3>
					<button className="icon-btn" aria-label="Close" onClick={onClose}>
						×
					</button>
				</header>
				{user ? (
					<DesignList
						onDone={(m) => {
							flash(m);
							onClose();
						}}
					/>
				) : (
					<AuthForms />
				)}
			</div>
		</div>
	);
}
