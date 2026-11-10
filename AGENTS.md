# Repository workflow

- The user wants this and all future application edits on the single continuing
  branch `app-updates`. Reuse it; do not create a branch or worktree for each fix.
- Fetch `origin` before starting. Bring newer `origin/main` changes into
  `app-updates` with a normal merge when needed, preserving existing work and
  history. Do not force-push or reset its history after a release. If GitHub
  deletes a merged remote branch automatically, push the continuing local
  `app-updates` history back under that same name.
- Commit and push validated changes to `app-updates`, and report the commit and
  branch link. The user has been merging reviewed updates into `main`.
- Edit source under `src/`, then run `npm run build` and include the regenerated
  self-contained `index.html` in the same commit.
- Run checks appropriate to the edit. Rendering changes should be exercised in
  the browser at the projector viewport (931 × 650) and a large desktop viewport,
  including playback and camera changes. Keep the orbital model unchanged unless
  a physics change is requested or necessary to fix a confirmed defect.
