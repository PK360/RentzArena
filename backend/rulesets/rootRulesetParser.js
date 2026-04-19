function parseRootRulesets(sourceText) {
  const entries = [];
  const lines = String(sourceText || '').split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    while (index < lines.length && !lines[index].trim()) {
      index += 1;
    }

    if (index >= lines.length) {
      break;
    }

    const label = lines[index].trim();
    index += 1;

    const typeLine = lines[index]?.trim() || '';
    const typeMatch = typeLine.match(/^type:\s*(\w+)$/);
    if (!typeMatch) {
      throw new Error(`Missing ruleset type for '${label}'`);
    }

    const type = typeMatch[1];
    index += 1;

    const codeLines = [];
    while (index < lines.length && lines[index].trim()) {
      codeLines.push(lines[index]);
      index += 1;
    }

    entries.push({
      label,
      type,
      code: codeLines.join('\n').trim()
    });
  }

  return entries;
}

module.exports = {
  parseRootRulesets
};
