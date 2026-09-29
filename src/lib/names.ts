/** First name for display and prompts, skipping titles like "Dr". */
export function firstName(name: string) {
  const parts = name.trim().split(/\s+/);
  const i = parts.findIndex((p) => !/^(dr|mr|mrs|ms|prof|sir|dame)\.?$/i.test(p));
  return parts[i >= 0 ? i : 0] || name;
}
