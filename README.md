# @zclt/github-cli

GitHub API CLI for querying repositories, issues, pull requests, and commits.

## Installation

```bash
npm install -g @zclt/github-cli
```

## Setup

```bash
export GITHUB_TOKEN=ghp_...
```

## Usage

```bash
github <command> [args] [flags]
```

### Commands

| Command | Description |
|---|---|
| `repo <owner/repo>` | Repository details |
| `repos <owner>` | List repositories for a user or org |
| `issues <owner/repo> [open\|closed\|all]` | List issues |
| `issue <owner/repo> <number>` | Issue detail |
| `prs <owner/repo> [open\|closed\|all]` | List pull requests |
| `pr <owner/repo> <number>` | Pull request detail |
| `commits <owner/repo> [branch] [n]` | Recent commits |
| `branches <owner/repo>` | List branches |
| `releases <owner/repo>` | List releases |
| `search issues <query>` | Search issues and PRs |
| `search repos <query>` | Search repositories |
| `search code <query>` | Search code |
| `user <username>` | User profile |
| `me` | Authenticated user |

### Pagination flags

| Flag | Description |
|---|---|
| `--all` | Fetch all pages |
| `--page <n>` | Fetch a specific page (default: 1) |
| `--per-page <n>` | Results per page (default: 50, max: 100) |
| `--max-pages <n>` | Cap when using `--all` (default: 10) |

## Examples

```bash
github repo zclt/script-tools
github prs zclt/script-tools open
github search issues "is:pr is:open user:zclt"
github commits zclt/script-tools main 20
github releases zclt/script-tools --all
```

## Claude Code skill

This package also ships as a [Claude Code](https://claude.ai/code) slash command. Copy `.claude/commands/github.js` and `.claude/commands/github.md` into your project's `.claude/commands/` directory to enable the `/github` skill.
