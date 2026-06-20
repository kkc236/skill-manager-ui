import { useCallback, useEffect, useState } from "react";
import { fetchInventory } from "../lib/apiClient";

export function useInventory({ onToast } = {}) {
  const [skills, setSkills] = useState([]);
  const [activity, setActivity] = useState([]);
  const [categories, setCategories] = useState([]);
  const [apiStatus, setApiStatus] = useState("connecting");
  const [apiMeta, setApiMeta] = useState({
    codexHome: "~/.codex",
    vaultRoot: "skill-vault",
  });

  const apiLive = apiStatus === "live";

  const applyInventory = useCallback((inventory) => {
    const nextSkills = inventory.skills ?? [];
    setSkills(nextSkills);
    setCategories(inventory.categories?.length ? inventory.categories : []);
    setActivity(inventory.activity?.length ? inventory.activity : []);
    setApiMeta({
      codexHome: inventory.codexHome ?? "~/.codex",
      vaultRoot: inventory.vaultRoot ?? "skill-vault",
    });
  }, []);

  const loadInventory = useCallback(
    async ({ silent = false } = {}) => {
      if (typeof fetch !== "function") {
        setApiStatus("offline");
        return null;
      }

      try {
        if (!silent) setApiStatus("connecting");
        const inventory = await fetchInventory();
        applyInventory(inventory);
        setApiStatus("live");
        return inventory;
      } catch (error) {
        setApiStatus("offline");
        if (!silent && onToast) onToast(`本地 API 未连接：${error.message}`);
        return null;
      }
    },
    [applyInventory, onToast],
  );

  useEffect(() => {
    loadInventory({ silent: true });
  }, [loadInventory]);

  return {
    skills,
    setSkills,
    activity,
    setActivity,
    categories,
    setCategories,
    apiStatus,
    apiLive,
    apiMeta,
    applyInventory,
    loadInventory,
  };
}
