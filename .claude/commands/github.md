Query the GitHub API using the script at `.claude/commands/github.js` (relative to the project root).

The script requires `GITHUB_TOKEN` to be set in the environment.

## How to translate the user's request

Map the user's natural language request to the correct command:

| Intent | Command |
|---|---|
| repo info / details about a repo | `repo <owner/repo>` |
| list repos of a user or org | `repos <owner>` |
| list issues | `issues <owner/repo> [open\|closed\|all]` |
| show a specific issue | `issue <owner/repo> <number>` |
| list pull requests | `prs <owner/repo> [open\|closed\|all]` |
| show a specific PR | `pr <owner/repo> <number>` |
| recent commits / commit history | `commits <owner/repo> [branch] [n]` |
| list branches | `branches <owner/repo>` |
| list releases / versions | `releases <owner/repo>` |
| search issues or PRs | `search issues <query>` |
| search repositories | `search repos <query>` |
| search code | `search code <query>` |
| user profile | `user <username>` |
| my profile / who am I | `me` |

## Pagination flags

Append to any list command when the user asks for more results:

- `--all` — fetch all pages (up to `--max-pages`, default 10)
- `--page <n>` — fetch a specific page
- `--per-page <n>` — results per page (max 100)
- `--max-pages <n>` — cap when using `--all`

## Execution

Run the resolved command with:

```
node .claude/commands/github.js <command> [args] [flags]
```

**IMPORTANT:** Always run each command as a separate Bash tool call. Never chain multiple `github.js` invocations with `&&`, `;`, or `|` in a single Bash call — this breaks the pre-approved permission pattern and triggers a permission prompt.

If `GITHUB_TOKEN` is not in the environment, tell the user to set it:
```
export GITHUB_TOKEN=ghp_...
```

## User request

$ARGUMENTS
