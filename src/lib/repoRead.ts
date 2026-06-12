// src/lib/repoRead.ts — GitHub/GitLab API üzerinden repo okuma

import type { GitRepo, GitAccount } from "./types";

const GITHUB_API = "https://api.github.com";
const GITLAB_API = "https://gitlab.com/api/v4";

interface RepoFileInfo {
  path: string;
  type: "file" | "dir";
  size?: number;
}

//─────── Dosya listeleme ───────
export async function listRepoFiles(
  repo: GitRepo,
  account: GitAccount,
  path?: string,
): Promise<RepoFileInfo[]> {
  if (account.provider === "github") {
    return listGitHubFiles(repo, account.token, path);
  }
  return listGitLabFiles(repo, account.token, path);
}

async function listGitHubFiles(
  repo: GitRepo,
  token: string,
  dirPath: string = "",
): Promise<RepoFileInfo[]> {
  const url = `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/contents/${dirPath}`;
  const branch = repo.branch ?? "main";
  const response = await fetch(`${url}?ref=${branch}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`GitHub API hatası: ${response.status}`);
  }

  const data = (await response.json()) as Array<{
    path: string;
    type: string;
    size?: number;
  }>;

  return data.map((item) => ({
    path: item.path,
    type: item.type === "dir" ? "dir" : "file",
    size: item.size,
  }));
}

async function listGitLabFiles(
  repo: GitRepo,
  token: string,
  dirPath: string = "",
): Promise<RepoFileInfo[]> {
  const encodedPath = encodeURIComponent(`${repo.owner}/${repo.repo}`);
  const branch = repo.branch ?? "main";
  const url = `${GITLAB_API}/projects/${encodedPath}/repository/tree?ref=${branch}&path=${dirPath}&per_page=100`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`GitLab API hatası: ${response.status}`);
  }

  const data = (await response.json()) as Array<{
    path: string;
    type: string;
  }>;

  return data.map((item) => ({
    path: item.path,
    type: item.type === "tree" ? "dir" : "file",
  }));
}

//─────── Dosya içeriği okuma ───────
export async function readRepoFile(
  path: string,
  repo: GitRepo,
  account: GitAccount,
): Promise<string> {
  if (account.provider === "github") {
    return readGitHubFile(path, repo, account.token);
  }
  return readGitLabFile(path, repo, account.token);
}

async function readGitHubFile(
  filePath: string,
  repo: GitRepo,
  token: string,
): Promise<string> {
  const url = `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/contents/${filePath}`;
  const branch = repo.branch ?? "main";
  const response = await fetch(`${url}?ref=${branch}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`Dosya okunamadı (${filePath}): ${response.status}`);
  }

  const data = (await response.json()) as {
    content?: string;
    encoding?: string;
  };

  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }

  throw new Error(`Beklenmeyen dosya formatı: ${filePath}`);
}

async function readGitLabFile(
  filePath: string,
  repo: GitRepo,
  token: string,
): Promise<string> {
  const encodedPath = encodeURIComponent(`${repo.owner}/${repo.repo}`);
  const encodedFilePath = encodeURIComponent(filePath);
  const branch = repo.branch ?? "main";
  const url = `${GITLAB_API}/projects/${encodedPath}/repository/files/${encodedFilePath}/raw?ref=${branch}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Dosya okunamadı (${filePath}): ${response.status}`);
  }

  return response.text();
}

//─────── Dosya içeriğini satır numaralarıyla formatla ───────
export function formatFileWithLineNumbers(content: string): string {
  const lines = content.split("\n");
  const width = String(lines.length).length;
  return lines
    .map((line, i) => {
      const num = String(i + 1).padStart(width, " ");
      return ` ${num} │ ${line}`;
    })
    .join("\n");
}
