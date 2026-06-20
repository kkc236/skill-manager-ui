import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { URL } from "node:url";
import {
  activateSkill,
  assignSkillCategory,
  createCategory,
  deactivateSkill,
  exportManifest,
  installSkillFromGithub,
  listSkills,
  readSkillFile,
  saveSkillFile,
  updateSkill,
} from "./skillService.js";

const host = process.env.SKILL_MANAGER_HOST ?? "127.0.0.1";
const port = Number(process.env.SKILL_MANAGER_PORT ?? 5174);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);

  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    await routeRequest(request, response, url);
  } catch (error) {
    sendError(response, error);
  }
});

async function routeRequest(request, response, url) {
  const route = `${request.method ?? "GET"} ${url.pathname}`;

  if (route === "GET /api/health") {
    sendJson(response, {
      ok: true,
      service: "skill-deck-api",
    });
    return;
  }

  if (route === "GET /api/skills") {
    sendJson(response, await listSkills());
    return;
  }

  if (route === "GET /api/manifest") {
    sendJson(response, await exportManifest());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/skills/install") {
    const body = await readJson(request);
    sendJson(response, await installSkillFromGithub(body.url, { activate: Boolean(body.activate) }), 201);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/categories") {
    const body = await readJson(request);
    sendJson(response, await createCategory(body.name), 201);
    return;
  }

  const categoryAction = url.pathname.match(/^\/api\/skills\/([^/]+)\/category$/);
  if (request.method === "POST" && categoryAction) {
    const body = await readJson(request);
    sendJson(response, await assignSkillCategory(decodeURIComponent(categoryAction[1]), body.categoryId));
    return;
  }

  const skillFile = url.pathname.match(/^\/api\/skills\/([^/]+)\/file$/);
  if (request.method === "GET" && skillFile) {
    sendJson(response, await readSkillFile(decodeURIComponent(skillFile[1])));
    return;
  }

  if (request.method === "POST" && skillFile) {
    const body = await readJson(request);
    sendJson(response, await saveSkillFile(decodeURIComponent(skillFile[1]), body.content));
    return;
  }

  const skillAction = url.pathname.match(/^\/api\/skills\/([^/]+)\/(activate|deactivate|update)$/);
  if (request.method === "POST" && skillAction) {
    const skillId = decodeURIComponent(skillAction[1]);
    const action = skillAction[2];

    if (action === "activate") {
      sendJson(response, await activateSkill(skillId));
      return;
    }

    if (action === "deactivate") {
      sendJson(response, await deactivateSkill(skillId));
      return;
    }

    if (action === "update") {
      sendJson(response, await updateSkill(skillId));
      return;
    }
  }

  sendJson(
    response,
    {
      error: `Route not found: ${request.method} ${url.pathname}`,
    },
    404,
  );
}

function sendJson(response, payload, statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, error) {
  const statusCode = Number(error.statusCode ?? 500);
  sendJson(
    response,
    {
      error: error.message ?? "Unexpected server error.",
    },
    statusCode,
  );
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(port, host, () => {
    console.log(`Skill Deck API listening on http://${host}:${port}`);
  });
}

export { server };
