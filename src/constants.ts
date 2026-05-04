
export const SUGGEST_TOOL_NAME = "suggest_skills";
export const DOWNLOAD_TOOL_NAME = "download_skill";
export const FETCH_MANIFEST_TOOL_NAME = "fetch_manifest";

export const toolDescriptions = {
  suggestSkills: "Suggest AI-agent skills for this repository.",
  downloadSkill: "Download a GitHub skill folder and return every file with its original relative path and text content.",
  fetchManifest: "Fetch a manifest file from a URL and return its text content.",
} as const;
