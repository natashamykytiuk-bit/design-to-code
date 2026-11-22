import { TOKEN_GROUPS } from "../model/types";
import { useActiveTheme, useStore } from "../model/store";

export function ThemeEditor() {
	const theme = useActiveTheme();
	const setToken = useStore((s) => s.setToken);
	return (
		<div className="theme-editor">
			<h2>Theme: {theme.name}</h2>
			<p className="hint">
				Edits apply to the active theme. Components reference these tokens, so changes show
				everywhere.
			</p>
			{TOKEN_GROUPS.map((group) => (
				<section key={group}>
					<h3>{group}</h3>
					<div className="token-grid">
						{Object.entries(theme.tokens[group]).map(([name, value]) => (
							<label key={name} className="field">
								<span>
									{group}.{name}
								</span>
								<div className="token-picker">
									{group === "color" && (
										<input
											type="color"
											value={value}
											onChange={(e) => setToken(group, name, e.target.value)}
										/>
									)}
									<input value={value} onChange={(e) => setToken(group, name, e.target.value)} />
								</div>
							</label>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
