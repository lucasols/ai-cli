import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { GeneratedPRContent } from './types.ts';

const AI_DESCRIPTION_MARKER = '<!-- AI_DESCRIPTION -->';

const DEFAULT_TEMPLATE = `## Summary

<!-- AI_DESCRIPTION -->

## Test Plan

- [ ] Tested locally
- [ ] Added/updated tests
`;

export type ParsedTemplate = {
  hasAIMarker: boolean;
  sections: TemplateSection[];
  rawTemplate: string;
};

export type TemplateSection = {
  name: string;
  content: string;
  hasChecklist: boolean;
};

export async function loadTemplate(templatePath: string): Promise<string> {
  const cwd = process.cwd();
  const fullPath = join(cwd, templatePath);

  if (!existsSync(fullPath)) {
    return DEFAULT_TEMPLATE;
  }

  const content = await readFile(fullPath, 'utf-8');
  return content;
}

export function parseTemplate(templateContent: string): ParsedTemplate {
  const hasAIMarker = templateContent.includes(AI_DESCRIPTION_MARKER);
  const sections = parseSections(templateContent);

  return {
    hasAIMarker,
    sections,
    rawTemplate: templateContent,
  };
}

function parseSections(content: string): TemplateSection[] {
  const lines = content.split('\n');
  const sections: TemplateSection[] = [];
  let currentSection: TemplateSection | null = null;
  let contentLines: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)$/);

    if (headerMatch && headerMatch[1]) {
      if (currentSection) {
        currentSection.content = contentLines.join('\n').trim();
        currentSection.hasChecklist = contentLines.some((l) =>
          l.match(/^[-*]\s*\[[ x]\]/i),
        );
        sections.push(currentSection);
      }

      currentSection = {
        name: headerMatch[1],
        content: '',
        hasChecklist: false,
      };
      contentLines = [];
    } else {
      contentLines.push(line);
    }
  }

  if (currentSection) {
    currentSection.content = contentLines.join('\n').trim();
    currentSection.hasChecklist = contentLines.some((l) =>
      l.match(/^[-*]\s*\[[ x]\]/i),
    );
    sections.push(currentSection);
  }

  return sections;
}

export function buildPRBody(
  template: ParsedTemplate,
  generatedContent: GeneratedPRContent | null,
): string {
  if (!generatedContent) {
    return template.rawTemplate.replace(AI_DESCRIPTION_MARKER, '').trim();
  }

  if (template.hasAIMarker) {
    const aiContent = formatGeneratedContent(generatedContent);
    return template.rawTemplate.replace(AI_DESCRIPTION_MARKER, aiContent);
  }

  const aiContent = formatGeneratedContent(generatedContent);
  const checklistSections = template.sections.filter((s) => s.hasChecklist);

  if (checklistSections.length > 0) {
    let body = `${aiContent}\n\n`;
    for (const section of checklistSections) {
      body += `## ${section.name}\n\n${section.content}\n\n`;
    }
    return body.trim();
  }

  return aiContent;
}

function formatGeneratedContent(content: GeneratedPRContent): string {
  const parts: string[] = [];

  if (content.summary) {
    parts.push(content.summary);
  }

  if (content.changes.length > 0) {
    parts.push('### Changes\n');
    for (const change of content.changes) {
      parts.push(`- ${change}`);
    }
  }

  if (content.testingNotes) {
    parts.push(`\n### Testing Notes\n\n${content.testingNotes}`);
  }

  return parts.join('\n');
}
