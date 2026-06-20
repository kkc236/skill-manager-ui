import { describe, expect, it } from "vitest";
import {
  applySkillFilter,
  installSkill,
  toggleSkill,
} from "./skillModel";

const sampleSkills = [
  {
    id: "pdf",
    name: "pdf",
    description: "Read and verify PDF files",
    installed: true,
    enabled: true,
    source: "system",
    status: "healthy",
  },
  {
    id: "japanese-tutor",
    name: "japanese-tutor",
    description: "Interactive Japanese learning assistant",
    installed: false,
    enabled: false,
    source: "github",
    status: "available",
  },
  {
    id: "frontend-app-builder",
    name: "frontend-app-builder",
    description: "Build polished frontend apps",
    installed: true,
    enabled: false,
    source: "plugin",
    status: "update",
  },
];

describe("skill model", () => {
  it("filters skills by search text and install status", () => {
    const result = applySkillFilter(sampleSkills, {
      query: "front",
      status: "installed",
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("frontend-app-builder");
  });

  it("toggles a skill without mutating the original list", () => {
    const next = toggleSkill(sampleSkills, "frontend-app-builder");

    expect(next.find((skill) => skill.id === "frontend-app-builder").enabled).toBe(true);
    expect(sampleSkills.find((skill) => skill.id === "frontend-app-builder").enabled).toBe(false);
  });

  it("installs a GitHub skill and records a readable activity item", () => {
    const result = installSkill(sampleSkills, "https://github.com/openclaw/skills/tree/main/skills/chndranndr/japanese-tutor");

    expect(result.skills.find((skill) => skill.id === "japanese-tutor").installed).toBe(true);
    expect(result.skills.find((skill) => skill.id === "japanese-tutor").enabled).toBe(true);
    expect(result.activity[0].title).toMatch(/japanese-tutor/);
  });
});
