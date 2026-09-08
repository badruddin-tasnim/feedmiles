# One-time setup

The GitHub connector that imported this repo isn't allowed to write to `.github/workflows/`, so the release workflow is staged here.

**Do this once:** in GitHub click **Add file → Create new file**, name it exactly

```
.github/workflows/release.yml
```

paste the contents of [`release.yml`](./release.yml) from this folder, and commit to `main`.

The workflow then runs automatically and:

1. restores the binary assets (icons, store screenshots) and commits them,
2. runs the test suite,
3. builds `feedmiles-store.zip` (manifest.json at the root — the file you upload to the Chrome Web Store),
4. tags `v<version from manifest.json>` and publishes a GitHub Release with the zip attached,
5. tries to enable GitHub Pages from `main` `/docs` for the privacy policy (if the default token can't, enable it once under Settings → Pages).

After that, this `setup/` folder can be deleted.
