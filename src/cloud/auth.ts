import { CLIENT_ID, USER_POOL_ID } from "./config";

/**
 * Minimal Cognito client using its public JSON API directly (no SDK needed for
 * a public app client). Tokens are kept in localStorage so sign-in survives reloads.
 */

const region = USER_POOL_ID.split("_")[0];
const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;
const STORAGE_KEY = "dtc.auth";

export type Session = {
	email: string;
	/** Sent to the API; API Gateway checks it against the user pool. */
	idToken: string;
	refreshToken: string;
	/** Epoch ms when idToken expires. */
	expiresAt: number;
};

export class AuthError extends Error {
	constructor(
		public code: string,
		message: string,
	) {
		super(message);
	}
}

async function call<T>(action: string, body: object): Promise<T> {
	const res = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-amz-json-1.1",
			"X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
		},
		body: JSON.stringify(body),
	});
	const data = await res.json();
	if (!res.ok) {
		const code = String(data.__type ?? "Error").split("#").pop()!;
		throw new AuthError(code, data.message ?? code);
	}
	return data as T;
}

type AuthResult = {
	AuthenticationResult: { IdToken: string; RefreshToken?: string; ExpiresIn: number };
};

function save(s: Session | null) {
	try {
		if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
		else localStorage.removeItem(STORAGE_KEY);
	} catch {
		/* storage unavailable: session lasts for this page only */
	}
}

function load(): Session | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as Session) : null;
	} catch {
		return null;
	}
}

export async function signUp(email: string, password: string): Promise<void> {
	await call("SignUp", {
		ClientId: CLIENT_ID,
		Username: email,
		Password: password,
		UserAttributes: [{ Name: "email", Value: email }],
	});
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
	await call("ConfirmSignUp", { ClientId: CLIENT_ID, Username: email, ConfirmationCode: code });
}

export async function resendCode(email: string): Promise<void> {
	await call("ResendConfirmationCode", { ClientId: CLIENT_ID, Username: email });
}

export async function signIn(email: string, password: string): Promise<Session> {
	const r = await call<AuthResult>("InitiateAuth", {
		ClientId: CLIENT_ID,
		AuthFlow: "USER_PASSWORD_AUTH",
		AuthParameters: { USERNAME: email, PASSWORD: password },
	});
	const a = r.AuthenticationResult;
	const s: Session = {
		email,
		idToken: a.IdToken,
		refreshToken: a.RefreshToken!,
		expiresAt: Date.now() + a.ExpiresIn * 1000,
	};
	save(s);
	return s;
}

export function signOut() {
	save(null);
}

/** The stored session, if any (may need refreshing before use). */
export function storedSession(): Session | null {
	return load();
}

/** A valid ID token, refreshing it if it expires within a minute. Null if signed out. */
export async function getIdToken(): Promise<string | null> {
	const s = load();
	if (!s) return null;
	if (s.expiresAt - Date.now() > 60_000) return s.idToken;
	try {
		const r = await call<AuthResult>("InitiateAuth", {
			ClientId: CLIENT_ID,
			AuthFlow: "REFRESH_TOKEN_AUTH",
			AuthParameters: { REFRESH_TOKEN: s.refreshToken },
		});
		const a = r.AuthenticationResult;
		const next = { ...s, idToken: a.IdToken, expiresAt: Date.now() + a.ExpiresIn * 1000 };
		save(next);
		return next.idToken;
	} catch {
		save(null);
		return null;
	}
}
