export function selectPublicProbeNames(args: string[], availableNames: readonly string[]): string[] {
  const requested: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--live' || args[index] === '--') continue;
    const toolName = args[index + 1];
    if (args[index] !== '--tool' || typeof toolName !== 'string' || toolName.length === 0) {
      throw new Error('Only --live and repeated --tool <exact-tool-name> options are supported.');
    }
    requested.push(toolName);
    index += 1;
  }
  if (requested.length === 0) return [...availableNames];
  if (new Set(requested).size !== requested.length) {
    throw new Error('A tool may be selected only once per probe run.');
  }
  const known = new Set(availableNames);
  const unknown = requested.filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown or unsafe public probe tool: ${unknown.join(', ')}`);
  }
  const selected = new Set(requested);
  return availableNames.filter((name) => selected.has(name));
}
