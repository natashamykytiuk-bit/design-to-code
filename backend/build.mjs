// Bundles the Lambda handler into a single file that Terraform zips and uploads.
import { build } from "esbuild";

await build({
	entryPoints: ["src/lambda.ts"],
	bundle: true,
	platform: "node",
	target: "node20",
	format: "esm",
	outfile: "dist/index.mjs",
	// Some dependencies still call require(); give ESM output a working one.
	banner: {
		js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
	},
	// The Lambda Node.js runtime already includes the AWS SDK v3.
	external: ["@aws-sdk/*"],
});
