# cowork-ui automatic deployment

The dedicated site is https://kai-shipcore.github.io/cowork-ui/ once the first Pages deployment succeeds. It is separate from cowork.coverland.com and the existing chatgpt.site publication.

Every push or merged pull request to `main` runs `.github/workflows/deploy-pages.yml`. Same-repository pull requests build and test without publishing. Fork pull requests skip this workflow because the UI dependency is private. Successful main builds upload only `frontend/dist` to GitHub Pages; failed builds leave the last successful site live.

## One-time repository settings

1. A repository administrator selects **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. `STORYBOOK_READ_KEY` must be an Actions repository secret containing a dedicated SSH private key. Register its matching public key as a **read-only** deploy key in `Coverland-Engineering/coverland-storybook`. Do not commit either credential or use a personal token with broader access.
3. Merge the workflow into `main`. Subsequent merges publish automatically. **Actions → Deploy cowork-ui to GitHub Pages → Run workflow** can redeploy main manually.

The workflow checks out the UI library at the pinned commit beside `cowork-ui`, builds it using its npm lockfile, then installs cowork-ui using its pnpm lockfile. This satisfies the existing `link:../../Coverland_Storybook` dependency without publishing the private library source. To upgrade the UI library, update the pinned `ref` in the workflow and review the resulting build.

## URLs and local development

Pages builds set `VITE_BASE_URL=/cowork-ui/` and `VITE_ROUTER_MODE=hash`. A shareable page URL looks like `/cowork-ui/#/products`; refreshing it works on static hosting. Local development keeps ordinary routes such as `/products`.

The site remains a frontend prototype with browser-local data. Pages does not deploy the backend or add shared storage/authentication. The old SSH workflow was removed from this repository so merges here no longer target the separate Workbench server. The inherited `.openai/hosting.json` is not used by this workflow.
