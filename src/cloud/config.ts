/**
 * Cloud features are configured with Vite env vars (see .env.example):
 *
 *   VITE_API_URL               API base URL. Unset → cloud features are hidden.
 *   VITE_COGNITO_USER_POOL_ID  Set → real sign-in with Cognito (AWS).
 *   VITE_COGNITO_CLIENT_ID     Unset → local dev: the API accepts a dev user, no sign-in.
 */
const env = import.meta.env;

export const API_URL: string = (env.VITE_API_URL ?? "").replace(/\/$/, "");
export const USER_POOL_ID: string = env.VITE_COGNITO_USER_POOL_ID ?? "";
export const CLIENT_ID: string = env.VITE_COGNITO_CLIENT_ID ?? "";

export type CloudMode = "off" | "local" | "aws";
export const cloudMode: CloudMode = !API_URL
	? "off"
	: USER_POOL_ID && CLIENT_ID
		? "aws"
		: "local";
