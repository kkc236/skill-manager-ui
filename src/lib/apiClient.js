async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return payload;
}

export function fetchInventory() {
  return request("/skills");
}

export function activateVaultSkill(skillId) {
  return request(`/skills/${encodeURIComponent(skillId)}/activate`, {
    method: "POST",
  });
}

export function deactivateVaultSkill(skillId) {
  return request(`/skills/${encodeURIComponent(skillId)}/deactivate`, {
    method: "POST",
  });
}

export function deleteVaultSkill(skillId) {
  return request(`/skills/${encodeURIComponent(skillId)}`, {
    method: "DELETE",
  });
}

export function updateVaultSkill(skillId) {
  return request(`/skills/${encodeURIComponent(skillId)}/update`, {
    method: "POST",
  });
}

export function installVaultSkill(url, options = {}) {
  return request("/skills/install", {
    body: JSON.stringify({
      activate: Boolean(options.activate),
      url,
    }),
    method: "POST",
  });
}

export function createVaultCategory(name) {
  return request("/categories", {
    body: JSON.stringify({ name }),
    method: "POST",
  });
}

export function assignVaultSkillCategory(skillId, categoryId) {
  return request(`/skills/${encodeURIComponent(skillId)}/category`, {
    body: JSON.stringify({ categoryId }),
    method: "POST",
  });
}

export function fetchVaultSkillFile(skillId) {
  return request(`/skills/${encodeURIComponent(skillId)}/file`);
}

export function saveVaultSkillFile(skillId, content) {
  return request(`/skills/${encodeURIComponent(skillId)}/file`, {
    body: JSON.stringify({ content }),
    method: "POST",
  });
}

export function fetchManifest() {
  return request("/manifest");
}
