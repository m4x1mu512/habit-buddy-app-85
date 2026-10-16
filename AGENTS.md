<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Native Android app via Capacitor; `/` is prerendered so `dist/client` (Capacitor webDir) is a static bundle — why: APK must run offline without the SSR server.
- All app state lives on-device in `@capacitor/preferences` (src/lib/storage.ts) — why: no backend, no auth by requirement.
- Pure habit rules live in src/lib/habits.ts with tests in habits.test.ts — why: keep rules testable without native APIs.
- Native APIs (notifications, status bar, back button) must be guarded with `Capacitor.isNativePlatform()` — why: the web preview must keep working.
