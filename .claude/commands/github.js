#!/usr/bin/env node
/**
 * GitHub API CLI — formatted for Claude Code skill output
 *
 * Usage:
 *   GITHUB_TOKEN=<pat> node github.js <command> [args...] [flags]
 *
 * Pagination flags (list commands):
 *   --all               fetch all pages automatically
 *   --page <n>          fetch a specific page (default: 1)
 *   --per-page <n>      results per page (default: 50, max: 100)
 *   --max-pages <n>     cap when using --all (default: 10)
 *
 * Commands:
 *   repo <owner/repo>                     — repo summary
 *   repos <owner>                         — list repos for user/org
 *   issues <owner/repo> [open|closed|all] — list issues
 *   issue <owner/repo> <number>           — issue detail
 *   prs <owner/repo> [open|closed|all]    — list pull requests
 *   pr <owner/repo> <number>              — PR detail
 *   commits <owner/repo> [branch] [n]     — recent commits (default 10)
 *   branches <owner/repo>                 — list branches
 *   releases <owner/repo>                 — list releases
 *   search issues <query>                 — search issues/PRs
 *   search repos <query>                  — search repositories
 *   search code <query>                   — search code
 *   user <username>                       — user profile
 *   me                                    — authenticated user
 */

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable is not set.");
  process.exit(1);
}

const BASE = "https://api.github.com";
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "github-cli-skill/1.0",
};

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = { page: 1, perPage: 50, maxPages: 10, all: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--all") {
      flags.all = true;
    } else if (argv[i] === "--page" && argv[i + 1]) {
      flags.page = parseInt(argv[++i], 10);
    } else if (argv[i] === "--per-page" && argv[i + 1]) {
      flags.perPage = Math.min(parseInt(argv[++i], 10), 100);
    } else if (argv[i] === "--max-pages" && argv[i + 1]) {
      flags.maxPages = parseInt(argv[++i], 10);
    } else {
      rest.push(argv[i]);
    }
  }
  return { flags, rest };
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

async function apiFetch(urlOrPath, params = {}) {
  const url = urlOrPath.startsWith("http")
    ? new URL(urlOrPath)
    : new URL(BASE + urlOrPath);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`GitHub API ${res.status}: ${body.message || res.statusText}`);
  }
  const data = await res.json();
  const nextUrl = parseNextLink(res.headers.get("link"));
  return { data, nextUrl };
}

async function api(path, params = {}) {
  const { data } = await apiFetch(path, params);
  return data;
}

async function apiAll(path, params = {}, maxPages = 10) {
  const items = [];
  let { data, nextUrl } = await apiFetch(path, params);
  items.push(...(Array.isArray(data) ? data : data.items ?? []));
  let pages = 1;
  const total = data.total_count;

  while (nextUrl && pages < maxPages) {
    ({ data, nextUrl } = await apiFetch(nextUrl));
    items.push(...(Array.isArray(data) ? data : data.items ?? []));
    pages++;
  }
  return { items, pages, hasMore: !!nextUrl, total };
}

async function apiPage(path, params = {}, page = 1) {
  const { data, nextUrl } = await apiFetch(path, { ...params, page });
  const items = Array.isArray(data) ? data : data.items ?? [];
  const total = data.total_count;
  const hasMore = !!nextUrl;
  return { items, hasMore, total };
}

// ── Formatters ────────────────────────────────────────────────────────────────

function date(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-CA") : "—";
}

function datetime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-CA")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function hr(char = "─", len = 60) {
  return char.repeat(len);
}

function badge(text) {
  return `[${text}]`;
}

function truncate(str, max = 80) {
  if (!str) return "";
  str = str.trim().split("\n")[0];
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function printRepo(r) {
  console.log(`\n${r.full_name}`);
  console.log(hr());
  if (r.description) console.log(`  ${r.description}`);
  console.log(`  URL        : ${r.html_url}`);
  console.log(`  Language   : ${r.language || "—"}`);
  console.log(`  Stars      : ${r.stargazers_count.toLocaleString()}   Forks: ${r.forks_count.toLocaleString()}   Watchers: ${r.watchers_count.toLocaleString()}`);
  console.log(`  Open issues: ${r.open_issues_count.toLocaleString()}`);
  console.log(`  Default br : ${r.default_branch}`);
  console.log(`  Visibility : ${r.private ? "private" : "public"}${r.archived ? "  [ARCHIVED]" : ""}${r.fork ? "  [FORK]" : ""}`);
  console.log(`  License    : ${r.license?.spdx_id || "none"}`);
  console.log(`  Created    : ${date(r.created_at)}   Updated: ${date(r.updated_at)}   Pushed: ${date(r.pushed_at)}`);
  if (r.topics?.length) console.log(`  Topics     : ${r.topics.join(", ")}`);
}

function printIssueRow(i) {
  const labels = i.labels?.map((l) => `#${l.name}`).join(" ") || "";
  const pr = i.pull_request ? " [PR]" : "";
  const assignee = i.assignee ? ` @${i.assignee.login}` : "";
  console.log(`  #${String(i.number).padEnd(6)} ${badge(i.state.toUpperCase())}${pr} ${truncate(i.title, 55)}`);
  if (labels) console.log(`         labels: ${labels}${assignee}  updated: ${date(i.updated_at)}`);
  else if (assignee) console.log(`         ${assignee}  updated: ${date(i.updated_at)}`);
}

function printIssueDetail(i) {
  const type = i.pull_request ? "Pull Request" : "Issue";
  console.log(`\n${type} #${i.number}: ${i.title}`);
  console.log(hr());
  console.log(`  Repo    : ${i.repository_url?.replace("https://api.github.com/repos/", "") || ""}`);
  console.log(`  State   : ${badge(i.state.toUpperCase())}${i.draft ? "  [DRAFT]" : ""}${i.merged ? "  [MERGED]" : ""}`);
  console.log(`  Author  : @${i.user?.login}   Created: ${datetime(i.created_at)}`);
  if (i.assignees?.length) console.log(`  Assigned: ${i.assignees.map((a) => "@" + a.login).join(", ")}`);
  if (i.labels?.length) console.log(`  Labels  : ${i.labels.map((l) => l.name).join(", ")}`);
  if (i.milestone) console.log(`  Milestone: ${i.milestone.title} (due: ${date(i.milestone.due_on)})`);
  console.log(`  Comments: ${i.comments}   Updated: ${datetime(i.updated_at)}`);
  if (i.closed_at) console.log(`  Closed  : ${datetime(i.closed_at)}`);
  if (i.body) {
    console.log(`\n  --- Body ---`);
    const lines = i.body.trim().split("\n").slice(0, 30);
    lines.forEach((l) => console.log(`  ${l}`));
    if (i.body.trim().split("\n").length > 30) console.log(`  … (truncated)`);
  }
}

function printCommit(c) {
  const msg = truncate(c.commit.message, 70);
  const author = c.commit.author?.name || c.author?.login || "unknown";
  const d = date(c.commit.author?.date);
  console.log(`  ${c.sha.slice(0, 7)}  ${d}  ${author.padEnd(18).slice(0, 18)}  ${msg}`);
}

// ── Commands ──────────────────────────────────────────────────────────────────

function pageInfo(pages, hasMore, total) {
  const more = hasMore ? " (more available, use --all or increase --max-pages)" : "";
  const tot = total != null ? `  total: ${total.toLocaleString()}` : "";
  return `${pages} page(s)${tot}${more}`;
}

async function cmdRepo(slug) {
  if (!slug) throw new Error("Usage: repo <owner/repo>");
  const r = await api(`/repos/${slug}`);
  printRepo(r);
  console.log();
}

async function cmdRepos(owner, flags = {}) {
  if (!owner) throw new Error("Usage: repos <owner>");
  const params = { per_page: flags.perPage, sort: "pushed", type: "all" };

  async function fetch(path) {
    if (flags.all) return apiAll(path, params, flags.maxPages);
    return apiPage(path, params, flags.page);
  }

  let result;
  try {
    result = await fetch(`/orgs/${owner}/repos`);
  } catch {
    result = await fetch(`/users/${owner}/repos`);
  }

  const { items, pages, hasMore } = result;
  console.log(`\nRepositories for ${owner} — ${pageInfo(pages, hasMore, null)} — ${items.length} shown\n${hr()}`);
  for (const r of items) {
    const f = [r.private ? "priv" : "pub", r.archived ? "archived" : null, r.fork ? "fork" : null]
      .filter(Boolean)
      .join(",");
    console.log(
      `  ${r.name.padEnd(40)} ${String(r.stargazers_count).padStart(5)}★  ${(r.language || "—").padEnd(14)}  pushed: ${date(r.pushed_at)}  [${f}]`
    );
  }
  console.log();
}

async function cmdIssues(slug, state = "open", flags = {}) {
  if (!slug) throw new Error("Usage: issues <owner/repo> [open|closed|all]");
  const params = { state, per_page: flags.perPage, sort: "updated" };

  let result;
  if (flags.all) {
    result = await apiAll(`/repos/${slug}/issues`, params, flags.maxPages);
  } else {
    result = await apiPage(`/repos/${slug}/issues`, params, flags.page);
  }

  const issues = result.items.filter((i) => !i.pull_request);
  console.log(`\nIssues for ${slug} — state: ${state} — ${pageInfo(result.pages, result.hasMore, null)} — ${issues.length} shown\n${hr()}`);
  issues.forEach(printIssueRow);
  console.log();
}

async function cmdIssue(slug, number) {
  if (!slug || !number) throw new Error("Usage: issue <owner/repo> <number>");
  const i = await api(`/repos/${slug}/issues/${number}`);
  printIssueDetail(i);
  console.log();
}

async function cmdPRs(slug, state = "open", flags = {}) {
  if (!slug) throw new Error("Usage: prs <owner/repo> [open|closed|all]");
  const params = { state, per_page: flags.perPage, sort: "updated" };

  let result;
  if (flags.all) {
    result = await apiAll(`/repos/${slug}/pulls`, params, flags.maxPages);
  } else {
    result = await apiPage(`/repos/${slug}/pulls`, params, flags.page);
  }

  console.log(`\nPull Requests for ${slug} — state: ${state} — ${pageInfo(result.pages, result.hasMore, null)} — ${result.items.length} shown\n${hr()}`);
  result.items.forEach(printIssueRow);
  console.log();
}

async function cmdPR(slug, number) {
  if (!slug || !number) throw new Error("Usage: pr <owner/repo> <number>");
  const pr = await api(`/repos/${slug}/pulls/${number}`);
  printIssueDetail(pr);
  console.log(`\n  Base ← Head : ${pr.base?.label} ← ${pr.head?.label}`);
  console.log(`  Commits     : ${pr.commits}   Changed files: ${pr.changed_files}`);
  console.log(`  +${pr.additions} / -${pr.deletions}`);
  console.log();
}

async function cmdCommits(slug, branch, nStr, flags = {}) {
  if (!slug) throw new Error("Usage: commits <owner/repo> [branch] [n]");
  const params = { per_page: flags.perPage };
  if (branch) params.sha = branch;

  let result;
  if (flags.all) {
    result = await apiAll(`/repos/${slug}/commits`, params, flags.maxPages);
  } else {
    const n = parseInt(nStr, 10) || 10;
    params.per_page = Math.min(n, 100);
    result = await apiPage(`/repos/${slug}/commits`, params, flags.page);
  }

  const label = branch ? ` (${branch})` : "";
  console.log(`\nCommits — ${slug}${label} — ${pageInfo(result.pages, result.hasMore, null)} — ${result.items.length} shown\n${hr()}`);
  console.log(`  SHA       Date        Author              Message`);
  console.log(`  ${hr("─", 56)}`);
  result.items.forEach(printCommit);
  console.log();
}

async function cmdBranches(slug, flags = {}) {
  if (!slug) throw new Error("Usage: branches <owner/repo>");
  const params = { per_page: flags.perPage };
  const repoPromise = api(`/repos/${slug}`);

  let result;
  if (flags.all) {
    result = await apiAll(`/repos/${slug}/branches`, params, flags.maxPages);
  } else {
    result = await apiPage(`/repos/${slug}/branches`, params, flags.page);
  }

  const repo = await repoPromise;
  console.log(`\nBranches for ${slug} — ${pageInfo(result.pages, result.hasMore, null)} — ${result.items.length} shown\n${hr()}`);
  for (const b of result.items) {
    const def = b.name === repo.default_branch ? " [default]" : "";
    console.log(`  ${b.name}${def}`);
  }
  console.log();
}

async function cmdReleases(slug, flags = {}) {
  if (!slug) throw new Error("Usage: releases <owner/repo>");
  const params = { per_page: flags.perPage };

  let result;
  if (flags.all) {
    result = await apiAll(`/repos/${slug}/releases`, params, flags.maxPages);
  } else {
    result = await apiPage(`/repos/${slug}/releases`, params, flags.page);
  }

  console.log(`\nReleases for ${slug} — ${pageInfo(result.pages, result.hasMore, null)} — ${result.items.length} shown\n${hr()}`);
  for (const r of result.items) {
    const f = [r.draft ? "[DRAFT]" : null, r.prerelease ? "[PRE]" : null].filter(Boolean).join(" ");
    console.log(`  ${r.tag_name.padEnd(20)} ${date(r.published_at)}  ${f}  ${truncate(r.name || "", 35)}`);
  }
  console.log();
}

async function cmdSearch(flags, type, ...terms) {
  const q = terms.join(" ");
  if (!type || !q) throw new Error("Usage: search <issues|repos|code> <query>");

  const perPage = flags.perPage;

  if (type === "issues") {
    let result;
    if (flags.all) {
      result = await apiAll("/search/issues", { q, per_page: perPage, sort: "updated" }, flags.maxPages);
    } else {
      result = await apiPage("/search/issues", { q, per_page: perPage, sort: "updated" }, flags.page);
    }
    console.log(`\nSearch issues: "${q}" — ${pageInfo(result.pages, result.hasMore, result.total)} — ${result.items.length} shown\n${hr()}`);
    result.items.forEach(printIssueRow);
  } else if (type === "repos") {
    let result;
    if (flags.all) {
      result = await apiAll("/search/repositories", { q, per_page: perPage, sort: "stars" }, flags.maxPages);
    } else {
      result = await apiPage("/search/repositories", { q, per_page: perPage, sort: "stars" }, flags.page);
    }
    console.log(`\nSearch repos: "${q}" — ${pageInfo(result.pages, result.hasMore, result.total)} — ${result.items.length} shown\n${hr()}`);
    for (const r of result.items) {
      console.log(
        `  ${r.full_name.padEnd(45)} ${String(r.stargazers_count).padStart(7)}★  ${(r.language || "—").padEnd(14)}  ${truncate(r.description || "", 40)}`
      );
    }
  } else if (type === "code") {
    let result;
    if (flags.all) {
      result = await apiAll("/search/code", { q, per_page: perPage }, flags.maxPages);
    } else {
      result = await apiPage("/search/code", { q, per_page: perPage }, flags.page);
    }
    console.log(`\nSearch code: "${q}" — ${pageInfo(result.pages, result.hasMore, result.total)} — ${result.items.length} shown\n${hr()}`);
    for (const item of result.items) {
      console.log(`  ${item.repository.full_name}  ${item.path}`);
      console.log(`    ${item.html_url}`);
    }
  } else {
    throw new Error(`Unknown search type: ${type}. Use: issues, repos, code`);
  }
  console.log();
}

async function cmdUser(username) {
  if (!username) throw new Error("Usage: user <username>");
  const u = await api(`/users/${username}`);
  console.log(`\n@${u.login}${u.name ? ` — ${u.name}` : ""}`);
  console.log(hr());
  if (u.bio) console.log(`  ${u.bio}`);
  console.log(`  Type      : ${u.type}`);
  console.log(`  Company   : ${u.company || "—"}`);
  console.log(`  Location  : ${u.location || "—"}`);
  console.log(`  Blog      : ${u.blog || "—"}`);
  console.log(`  Repos     : ${u.public_repos} public   Gists: ${u.public_gists}`);
  console.log(`  Followers : ${u.followers}   Following: ${u.following}`);
  console.log(`  GitHub URL: ${u.html_url}`);
  console.log(`  Joined    : ${date(u.created_at)}`);
  console.log();
}

async function cmdMe() {
  const u = await api("/user");
  await cmdUser(u.login);
  const plan = u.plan;
  if (plan) console.log(`  Plan: ${plan.name}  (private repos: ${plan.private_repos})\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const [, , cmd, ...rawArgs] = process.argv;
const { flags, rest } = parseArgs(rawArgs);

const commands = {
  repo:     () => cmdRepo(rest[0]),
  repos:    () => cmdRepos(rest[0], flags),
  issues:   () => cmdIssues(rest[0], rest[1], flags),
  issue:    () => cmdIssue(rest[0], rest[1]),
  prs:      () => cmdPRs(rest[0], rest[1], flags),
  pr:       () => cmdPR(rest[0], rest[1]),
  commits:  () => cmdCommits(rest[0], rest[1], rest[2], flags),
  branches: () => cmdBranches(rest[0], flags),
  releases: () => cmdReleases(rest[0], flags),
  search:   () => cmdSearch(flags, ...rest),
  user:     () => cmdUser(rest[0]),
  me:       () => cmdMe(),
};

if (!cmd || !commands[cmd]) {
  console.log(`GitHub API CLI — available commands:

  repo <owner/repo>
  repos <owner>
  issues <owner/repo> [open|closed|all]
  issue <owner/repo> <number>
  prs <owner/repo> [open|closed|all]
  pr <owner/repo> <number>
  commits <owner/repo> [branch] [n]
  branches <owner/repo>
  releases <owner/repo>
  search issues|repos|code <query>
  user <username>
  me

Pagination flags (list commands):
  --all               fetch all pages automatically
  --page <n>          fetch specific page (default: 1)
  --per-page <n>      results per page (default: 50, max: 100)
  --max-pages <n>     cap for --all (default: 10)

Environment: GITHUB_TOKEN must be set.`);
  process.exit(cmd ? 1 : 0);
}

commands[cmd]().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
