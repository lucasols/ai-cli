import { z } from 'zod';
import { runCmd, runCmdUnwrap } from './shell.ts';
import { git } from './git.ts';

const prDataSchema = z.object({
  title: z.string(),
  changedFiles: z.number(),
  baseRefName: z.string(),
  headRefName: z.string(),
  author: z.object({ login: z.string() }),
});

export type PRData = z.infer<typeof prDataSchema>;

const ghPRCommentSchema = z.object({
  id: z.number(),
  user: z.object({ login: z.string(), type: z.string() }),
  body: z.string(),
  path: z.string().optional(),
  line: z.number().optional(),
  original_line: z.number().optional(),
  side: z.string().optional(),
  in_reply_to_id: z.number().optional(),
  created_at: z.string(),
});

export type GhPRComment = z.infer<typeof ghPRCommentSchema>;

async function ghApi(endpoint: string, perPage = 100): Promise<string> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const endpointWithPerPage = `${endpoint}${separator}per_page=${perPage}`;

  return runCmdUnwrap(['gh', 'api', endpointWithPerPage], {
    silent: true,
    noColor: true,
  });
}

export async function getPRData(prNumber: string): Promise<PRData> {
  const result = await runCmdUnwrap(
    [
      'gh',
      'pr',
      'view',
      prNumber,
      '--json',
      'title,changedFiles,baseRefName,headRefName,author',
    ],
    { silent: true, noColor: true },
  );

  return prDataSchema.parse(JSON.parse(result));
}

export async function getChangedFiles(prNumber: string): Promise<string[]> {
  const result = await runCmdUnwrap(
    ['gh', 'pr', 'view', prNumber, '--json', 'files'],
    { silent: true, noColor: true },
  );

  const schema = z.object({
    files: z.array(z.object({ path: z.string() })),
  });

  const parsed = schema.parse(JSON.parse(result));
  return parsed.files.map((file) => file.path);
}

export async function getPRIssueComments(
  prNumber: string,
): Promise<GhPRComment[]> {
  const { owner, repo } = await git.getRepoInfo();
  const result = await ghApi(
    `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
  );

  return z.array(ghPRCommentSchema).parse(JSON.parse(result));
}

export async function createPRComment(
  prNumber: string,
  body: string,
  marker: string,
): Promise<void> {
  // First delete old comments with the same marker
  await deletePRComments(prNumber, marker);

  // Create new comment
  await runCmdUnwrap([
    'gh',
    'pr',
    'comment',
    prNumber,
    '--body',
    `<!-- ${marker} -->\n\n${body}`,
  ]);
}

export async function deletePRComments(
  prNumber: string,
  marker: string,
): Promise<number> {
  const { owner, repo } = await git.getRepoInfo();
  const result = await ghApi(
    `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
  );

  const schema = z.array(
    z.object({
      id: z.number(),
      user: z.object({ login: z.string() }),
      body: z.string(),
    }),
  );

  const comments = schema.parse(JSON.parse(result));
  const commentsToDelete = comments.filter((comment) =>
    comment.body.includes(marker),
  );

  if (commentsToDelete.length === 0) {
    return 0;
  }

  let deletedCount = 0;
  for (const comment of commentsToDelete) {
    const deleteResult = await runCmd([
      'gh',
      'api',
      '--method',
      'DELETE',
      '-H',
      'Accept: application/vnd.github+json',
      `/repos/${owner}/${repo}/issues/comments/${comment.id}`,
    ]);

    if (!deleteResult.error) {
      deletedCount++;
    }
  }

  return deletedCount;
}

export function isHumanUser(user: { login: string; type: string }): boolean {
  return !user.login.includes('[bot]') && user.type !== 'Bot';
}

export type GeneralPRComment = {
  author: string;
  body: string;
  createdAt: string;
};

export async function getAllHumanPRComments(
  prNumber: string,
): Promise<GeneralPRComment[]> {
  try {
    const issueComments = await getPRIssueComments(prNumber);

    const humanComments = issueComments.filter(
      (comment) => isHumanUser(comment.user) && !comment.in_reply_to_id,
    );

    return humanComments.map((comment) => ({
      author: comment.user.login,
      body: comment.body,
      createdAt: comment.created_at,
    }));
  } catch {
    return [];
  }
}

export const github = {
  getPRData,
  getChangedFiles,
  getPRIssueComments,
  createPRComment,
  deletePRComments,
  isHumanUser,
  getAllHumanPRComments,
};
