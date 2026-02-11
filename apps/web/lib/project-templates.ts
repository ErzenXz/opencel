import { Database, FileCode2, Globe, ServerCog } from "lucide-react";

export type ProjectTemplate = {
  id: "web-service" | "static-site" | "database" | "fullstack";
  label: string;
  description: string;
  icon: typeof Globe;
  suggestedRepo: string;
  suggestedBuildPreset: string;
  suggestedRootDir: string;
  hints: string[];
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "web-service",
    label: "Web Service",
    description: "Deploy an API or backend service from a GitHub repo.",
    icon: ServerCog,
    suggestedRepo: "owner/backend-service",
    suggestedBuildPreset: "docker",
    suggestedRootDir: ".",
    hints: ["Great for Go/Node APIs", "Supports preview and production deployments"]
  },
  {
    id: "static-site",
    label: "Static Page",
    description: "Ship static or JAMStack frontends with fast previews.",
    icon: Globe,
    suggestedRepo: "owner/static-site",
    suggestedBuildPreset: "static",
    suggestedRootDir: ".",
    hints: ["Perfect for docs, marketing and portfolios", "Use custom domains once deployed"]
  },
  {
    id: "database",
    label: "Database Tooling",
    description: "Manage DB migration or admin repos as deployment projects.",
    icon: Database,
    suggestedRepo: "owner/database-tooling",
    suggestedBuildPreset: "worker",
    suggestedRootDir: ".",
    hints: ["Useful for migration jobs and database utilities", "Set secure env vars before deploying"]
  },
  {
    id: "fullstack",
    label: "Fullstack App",
    description: "Run frontend and backend from one repository.",
    icon: FileCode2,
    suggestedRepo: "owner/fullstack-app",
    suggestedBuildPreset: "auto",
    suggestedRootDir: ".",
    hints: ["Works with monorepos", "Set root directory and build preset for best results"]
  }
];

export function getProjectTemplate(templateID: ProjectTemplate["id"]) {
  return PROJECT_TEMPLATES.find((t) => t.id === templateID) || PROJECT_TEMPLATES[0];
}
