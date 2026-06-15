| Name | Description | Bundled Assets |
| -----|-------------|----------------|
| [agent-transcript](https://github.com/steipete/agent-scripts/tree/main/skills/agent-transcript) | GitHub PR/issue agent transcripts: redact, preview, and insert safely. | `scripts/agent-transcript` |
| [beeper](https://github.com/steipete/agent-scripts/tree/main/skills/beeper) | Beeper cache: contact hints, room lookup, WhatsApp/iMessage traces, FTS. | None |
| [browser-use](https://github.com/steipete/agent-scripts/tree/main/skills/browser-use) | Existing Chrome automation: Chrome plugin first, mcporter fallback. | `mcporter-config.md` |
| [clawsweeper-status](https://github.com/steipete/agent-scripts/tree/main/skills/clawsweeper-status) | ClawSweeper status: URLs, workflow health, active workers, ops snapshot. | `agents/openai.yaml`, `scripts/clawsweeper-status.sh` |
| [clickclack](https://github.com/steipete/agent-scripts/tree/main/skills/clickclack) | ClickClack ops: chat app, Hetzner deploy, DNS/docs/app, Docker rollout. | `agents/openai.yaml` |
| [cloudflare-registrar](https://github.com/steipete/agent-scripts/tree/main/skills/cloudflare-registrar) | Cloudflare Registrar: domain availability, prices, registration via mcporter. | None |
| [codex-debugging](https://github.com/steipete/agent-scripts/tree/main/skills/codex-debugging) | Codex debugging: codex-rs core/tui/exec/cli/app-server/config. | None |
| [create-cli](https://github.com/steipete/agent-scripts/tree/main/skills/create-cli) | CLI UX/spec: args, flags, help, output, errors, config, dry-run. | `references/cli-guidelines.md` |
| [discord-clawd](https://github.com/steipete/agent-scripts/tree/main/skills/discord-clawd) | Discord-backed OpenClaw agent/session relay; not archive search. | `agents/openai.yaml` |
| [domain-dns-ops](https://github.com/steipete/agent-scripts/tree/main/skills/domain-dns-ops) | DNS/domain ops: registrars, zones, redirects, DNS/HTTP verify, manager truth. | `references/manager-repo.md` |
| [frontend-design](https://github.com/steipete/agent-scripts/tree/main/skills/frontend-design) | Frontend UI: pages, apps, components, polished non-generic design. | `LICENSE.txt` |
| [github-author-context](https://github.com/steipete/agent-scripts/tree/main/skills/github-author-context) | GitHub contributor context: identity, activity, trust, company/team signal. | `agents/openai.yaml` |
| [github-cache-hygiene](https://github.com/steipete/agent-scripts/tree/main/skills/github-cache-hygiene) | GitHub quota/cache hygiene: gh, ghx, xcache, gitcrawl, mirrors, limits. | `agents/openai.yaml` |
| [github-deep-review](https://github.com/steipete/agent-scripts/tree/main/skills/github-deep-review) | GitHub deep review: bugs, PRs, best fix, stale-or-real, read code first. | `agents/openai.yaml` |
| [github-project-triage](https://github.com/steipete/agent-scripts/tree/main/skills/github-project-triage) | GitHub issue/PR triage: queues, CI, blockers, risk, proof, next actions. | `agents/openai.yaml`, `scripts/github-activity.sh` |
| [hopper-debugger](https://github.com/steipete/agent-scripts/tree/main/skills/hopper-debugger) | Hopper debugging: macOS/iOS binaries, ObjC/Swift symbols, dyld, LLDB. | `agents/openai.yaml` |
| [instruments-profiling](https://github.com/steipete/agent-scripts/tree/main/skills/instruments-profiling) | Instruments/xctrace profiling: macOS/iOS traces, binaries, args, exports. | None |
| [mac-maintenance](https://github.com/steipete/agent-scripts/tree/main/skills/mac-maintenance) | Mac upkeep: brew update/upgrade, pull clean repos, empty Trash. | None |
| [maintainer-orchestrator](https://github.com/steipete/agent-scripts/tree/main/skills/maintainer-orchestrator) | Delegated maintainer ops: decision-ready PRs, worker monitoring, queue cleanup, releases. | `agents/openai.yaml` |
| [markdown-converter](https://github.com/steipete/agent-scripts/tree/main/skills/markdown-converter) | Markdown conversion: PDF, Office, HTML, data, OCR, audio, ZIP, YouTube. | None |
| [nano-banana-pro](https://github.com/steipete/agent-scripts/tree/main/skills/nano-banana-pro) | Nano Banana/Gemini image gen/edit: text/image input, 512-4K workflows. | `scripts/generate_image.py` |
| [native-app-performance](https://github.com/steipete/agent-scripts/tree/main/skills/native-app-performance) | Native app performance: xctrace, Time Profiler, traces, hotspots. | `scripts/extract_time_samples.py`, `scripts/record_time_profiler.sh`, `scripts/top_hotspots.py` |
| [notcrawl](https://github.com/steipete/agent-scripts/tree/main/skills/notcrawl) | Notion archive: desktop/API sync, Markdown export, page search, read-only SQL. | None |
| [npm](https://github.com/steipete/agent-scripts/tree/main/skills/npm) | npm registry ops: login, whoami, names, publish; 1Password tmux. | `scripts/reserve-packages.sh` |
| [obsidian](https://github.com/steipete/agent-scripts/tree/main/skills/obsidian) | Obsidian vault: search/read/write notes, backlinks, Bases, Canvas. | None |
| [one-password](https://github.com/steipete/agent-scripts/tree/main/skills/one-password) | 1Password/op: service-account first, targeted secret read/store/inject, tmux. | `references/cli-examples.md`, `references/get-started.md` |
| [openai-image-gen](https://github.com/steipete/agent-scripts/tree/main/skills/openai-image-gen) | OpenAI Images API: batches, prompt sampler, gallery. | `scripts/gen.py` |
| [openclaw-relay](https://github.com/steipete/agent-scripts/tree/main/skills/openclaw-relay) | OpenClaw session relay: prompts/posts via local/remote acpx over SSH. | `agents/openai.yaml`, `config/session_aliases.json`, `scripts/openclaw_relay.py` |
| [oracle](https://github.com/steipete/agent-scripts/tree/main/skills/oracle) | Oracle second-model review: bundle prompts/files, debug, refactor, design. | None |
| [peekaboo](https://github.com/steipete/agent-scripts/tree/main/skills/peekaboo) | macOS screenshots, UI inspect, clicks, typing, app/window automation. | None |
| [release-mac-app](https://github.com/steipete/agent-scripts/tree/main/skills/release-mac-app) | macOS app release: Sparkle, notarization, GitHub Release, Homebrew, closeout. | `scripts/lib/mac_release.sh`, `scripts/mac-release` |
| [release-tweets](https://github.com/steipete/agent-scripts/tree/main/skills/release-tweets) | Release tweets: draft/copy/post from changelog, tags, npm/appcast, artifacts. | `agents/openai.yaml` |
| [reminders](https://github.com/steipete/agent-scripts/tree/main/skills/reminders) | Apple Reminders via rem CLI: add, list, search, update, complete, delete. | None |
| [remote-mac](https://github.com/steipete/agent-scripts/tree/main/skills/remote-mac) | Remote Macs: MacBook, Mac Studio, clawmac, Tailscale, SSH, OpenClaw. | None |
| [skill-cleaner](https://github.com/steipete/agent-scripts/tree/main/skills/skill-cleaner) | Codex/OpenClaw skill audit: live budget, usage, duplicates, compact descriptions. | `agents/openai.yaml`, `scripts/skill-cleaner.test.ts`, `scripts/skill-cleaner.ts` |
| [sonos](https://github.com/steipete/agent-scripts/tree/main/skills/sonos) | Sonos control: search, queue, playlists, rooms/groups, volume, YouTube. | `agents/openai.yaml` |
| [speaking](https://github.com/steipete/agent-scripts/tree/main/skills/speaking) | Speaking ops: invites, keynotes, panels, Gmail/calendar, conferences. | `agents/openai.yaml` |
| [ssh-doctor](https://github.com/steipete/agent-scripts/tree/main/skills/ssh-doctor) | SSH triage: Remote Login, launchd sshd, pre-auth closes, stale sessions. | None |
| [swift-concurrency-expert](https://github.com/steipete/agent-scripts/tree/main/skills/swift-concurrency-expert) | Swift concurrency review/fix: compiler errors, Sendable, isolation, remediation. | `references/swift-6-2-concurrency.md`, `references/swiftui-concurrency-tour-wwdc.md` |
| [swiftui-liquid-glass](https://github.com/steipete/agent-scripts/tree/main/skills/swiftui-liquid-glass) | SwiftUI Liquid Glass: implement, adopt, refactor, review correctness/perf/design. | `references/liquid-glass.md` |
| [swiftui-performance-audit](https://github.com/steipete/agent-scripts/tree/main/skills/swiftui-performance-audit) | SwiftUI performance: render, scroll, CPU/memory, updates, layout, Instruments. | `references` (4 files) |
| [swiftui-view-refactor](https://github.com/steipete/agent-scripts/tree/main/skills/swiftui-view-refactor) | SwiftUI view refactor/review: layout, DI, Observation, view models. | `references/mv-patterns.md` |
| [things-todo](https://github.com/steipete/agent-scripts/tree/main/skills/things-todo) | Things 3 via things CLI: add, list, search, update, delete, verify. | None |
| [twilio-sms](https://github.com/steipete/agent-scripts/tree/main/skills/twilio-sms) | Twilio SMS CLI: buy/list/keep numbers, send/check messages, credential routing. | `agents/openai.yaml` |
| [video-transcript-downloader](https://github.com/steipete/agent-scripts/tree/main/skills/video-transcript-downloader) | yt-dlp downloads: video, audio, subtitles, transcripts, clips, playlists. | `package-lock.json`, `package.json`, `scripts/vtd.js` |
| [vm-lab](https://github.com/steipete/agent-scripts/tree/main/skills/vm-lab) | Parallels macOS VM lab: GUI automation, Peekaboo, TCC, Ghostty. | `agents/openai.yaml`, `scripts/parallels_type.py` |
| [whatsapp](https://github.com/steipete/agent-scripts/tree/main/skills/whatsapp) | WhatsApp router: history/search/read/send; wacrawl read, wacli live. | None |
| [wrangler](https://github.com/steipete/agent-scripts/tree/main/skills/wrangler) | Wrangler CLI: Workers, KV, tail, deploy, account routing. | `agents/openai.yaml` |
| [xurl](https://github.com/steipete/agent-scripts/tree/main/skills/xurl) | xurl X API CLI: install, auth, app choice, shortcuts, raw endpoints. | None |
