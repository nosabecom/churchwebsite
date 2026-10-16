# Repository instructions

## Windows shell quoting

Avoid nested shell commands for file deletion, especially PowerShell → cmd /c → rmdir. Use PowerShell's Remove-Item -LiteralPath with a single-quoted path or a path variable.

PowerShell does not use backslash to escape quotes. Never use \" as a PowerShell quote escape. Do not interpolate deletion paths into command strings that another shell will parse.

## Merging pull requests

When the user authorizes merging a pull request, validate the change and check CI results, then use `gh pr merge --squash --admin` to merge it. The `--admin` flag is the user's preferred merge method for this repository.

## Reverting pull requests

When the user asks to revert a pull request, use GitHub's native Revert flow on the merged pull request to create a dedicated revert pull request. Do not substitute a local `git revert` or combine the revert with replacement changes. Keep any requested follow-up changes in a separate pull request. If GitHub's Revert flow is unavailable, explain the blocker before using a different approach.
