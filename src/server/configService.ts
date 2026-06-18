import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { buildServiceRecord, serviceId } from "./serviceMetadata";

type LocalConfig = {
  version: number;
  serviceId?: string;
  selfRegistration?: "on" | "off";
  configServiceUrl?: string;
  preferredPort?: number;
};

type ServiceRecord = {
  id: string;
  name?: string;
  baseUrl: string;
  endpoints?: Record<string, string>;
};

type StartupDecision = {
  port: number;
  configServiceUrl: string;
  shouldRegister: boolean;
  reason: string;
};

const configPath = path.resolve("tools", "config-service.json");

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function normalizeBaseUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Config-service URL must use http or https: ${value}`);
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

async function readLocalConfig() {
  const config = await readJsonFile<LocalConfig>(configPath);
  if (!config) {
    throw new Error("Missing tools/config-service.json. Cannot start a GI-registered web service.");
  }
  if (config.serviceId && config.serviceId !== serviceId) {
    throw new Error(`tools/config-service.json serviceId must be ${serviceId}.`);
  }
  return config;
}

async function resolveConfigServiceUrl(config: LocalConfig) {
  if (process.env.GI_CONFIG_SERVICE_URL) {
    return normalizeBaseUrl(process.env.GI_CONFIG_SERVICE_URL);
  }
  if (config.configServiceUrl) {
    return normalizeBaseUrl(config.configServiceUrl);
  }
  const giHome = process.env.GENERAL_INSTRUCTIONS_HOME;
  if (giHome) {
    const mainConfig = await readJsonFile<{ configServiceUrl?: string }>(
      path.join(giHome, "config", "gi-main.json")
    );
    if (mainConfig?.configServiceUrl) {
      return normalizeBaseUrl(mainConfig.configServiceUrl);
    }
  }
  throw new Error("No config-service URL configured. Set tools/config-service.json configServiceUrl.");
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });
  if (!response.ok) {
    throw new Error(`${init?.method || "GET"} ${url} failed with HTTP ${response.status}.`);
  }
  return (await response.json()) as T;
}

async function requestJsonOrNull<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GET ${url} failed with HTTP ${response.status}.`);
  }
  return (await response.json()) as T;
}

function portFromBaseUrl(baseUrl: string) {
  const parsed = new URL(baseUrl);
  const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid service record port in ${baseUrl}.`);
  }
  return port;
}

function isPortFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function registryUsesPort(services: Record<string, ServiceRecord>, port: number) {
  return Object.values(services).some((service) => {
    try {
      return portFromBaseUrl(service.baseUrl) === port;
    } catch {
      return false;
    }
  });
}

async function chooseRegistrationPort(config: LocalConfig, services: Record<string, ServiceRecord>) {
  const preferred = config.preferredPort || Number(process.env.PORT || 8787);
  for (let port = preferred; port < preferred + 100; port += 1) {
    if (registryUsesPort(services, port)) {
      continue;
    }
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error(`No free unregistered port found starting at ${preferred}.`);
}

async function assertConfigServiceReady(configServiceUrl: string) {
  await requestJson(`${configServiceUrl}/health`);
  const guide = await requestJson<{ endpoints?: Record<string, string> }>(`${configServiceUrl}/agent/guide`);
  const contract = await requestJson<{ operations?: Array<{ method: string; path: string }> }>(
    `${configServiceUrl}/agent/contract`
  );
  const canPutService = contract.operations?.some(
    (operation) => operation.method === "PUT" && operation.path === "/services/{serviceId}"
  );
  if (!canPutService) {
    throw new Error("Config-service contract does not document PUT /services/{serviceId}.");
  }
  if (guide.endpoints?.contract && guide.endpoints.contract !== "/agent/contract") {
    throw new Error("Config-service guide/contract endpoint mismatch.");
  }
}

export async function resolveStartupDecision(): Promise<StartupDecision> {
  const config = await readLocalConfig();
  const configServiceUrl = await resolveConfigServiceUrl(config);
  await assertConfigServiceReady(configServiceUrl);

  const existing = await requestJsonOrNull<ServiceRecord>(`${configServiceUrl}/services/${serviceId}`);
  if (existing) {
    return {
      port: portFromBaseUrl(existing.baseUrl),
      configServiceUrl,
      shouldRegister: true,
      reason: "existing service record found"
    };
  }

  if (config.selfRegistration !== "on") {
    throw new Error(
      `Service ${serviceId} is missing from config-service and selfRegistration is not on.`
    );
  }

  const list = await requestJson<{ services: Record<string, ServiceRecord> }>(`${configServiceUrl}/services`);
  return {
    port: await chooseRegistrationPort(config, list.services || {}),
    configServiceUrl,
    shouldRegister: true,
    reason: "missing service record; self-registration is on"
  };
}

export async function registerService(configServiceUrl: string, port: number) {
  return requestJson(`${configServiceUrl}/services/${serviceId}`, {
    method: "PUT",
    body: JSON.stringify(buildServiceRecord(port))
  });
}
