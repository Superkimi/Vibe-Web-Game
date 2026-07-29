const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const basePath =
  configuredBasePath === "/" ? "" : configuredBasePath.replace(/\/$/, "");

export function withBasePath(path: string) {
  if (!path.startsWith("/")) return path;
  return `${basePath}${path}`;
}
