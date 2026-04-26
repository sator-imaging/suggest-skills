| Name | Description | Bundled Assets |
| -----|-------------|----------------|
| [async-pr-review](https://github.com/google-gemini/gemini-cli/tree/main/.gemini/skills/async-pr-review) | Trigger this skill when the user wants to start an asynchronous PR review, run background checks on a PR, or check the status of a previously started async PR review. | `policy.toml`, `scripts/async-review.sh`, `scripts/check-async-review.sh` |
| [behavioral-evals](https://github.com/google-gemini/gemini-cli/tree/main/.gemini/skills/behavioral-evals) | Guidance for creating, running, fixing, and promoting behavioral evaluations. Use when verifying agent decision logic, debugging failures, debugging prompt steering, or adding workspace regression tests. | `assets` (2 files), `references` (4 files) |
| [ci](https://github.com/google-gemini/gemini-cli/tree/main/.gemini/skills/ci) |  | `scripts/ci.mjs` |
| [code-reviewer](https://github.com/google-gemini/gemini-cli/tree/main/.gemini/skills/code-reviewer) |  | None |
| [docs-changelog](https://github.com/google-gemini/gemini-cli/tree/main/.gemini/skills/docs-changelog) | Generates and formats changelog files for a new release based on provided version and raw changelog data. | `references` (4 files) |
| [docs-writer](https://github.com/google-gemini/gemini-cli/tree/main/.gemini/skills/docs-writer) |  | `quota-limit-style-guide.md`, `references/docs-auditing.md` |
| [github-issue-creator](https://github.com/google-gemini/gemini-cli/tree/main/.gemini/skills/github-issue-creator) |  | None |
| [pr-address-comments](https://github.com/google-gemini/gemini-cli/tree/main/.gemini/skills/pr-address-comments) | Use this skill if the user asks you to help them address GitHub PR comments for their current branch of the Gemini CLI. Requires `gh` CLI tool. | `scripts/fetch-pr-info.js` |
| [pr-creator](https://github.com/google-gemini/gemini-cli/tree/main/.gemini/skills/pr-creator) |  | None |
| [review-duplication](https://github.com/google-gemini/gemini-cli/tree/main/.gemini/skills/review-duplication) | Use this skill during code reviews to proactively investigate the codebase for duplicated functionality, reinvented wheels, or failure to reuse existing project best practices and shared utilities. | None |
| [string-reviewer](https://github.com/google-gemini/gemini-cli/tree/main/.gemini/skills/string-reviewer) | Use this skill when asked to review text and user-facing strings within the codebase. It ensures that these strings follow rules on clarity, usefulness, brevity and style. | `references/settings.md`, `references/word-list.md` |
