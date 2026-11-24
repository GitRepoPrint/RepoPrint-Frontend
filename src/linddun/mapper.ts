import type { CanonicalDfd, CanonicalElement, CanonicalFlow } from "./types";

// Padrões para inferência de identificadores diretos, pseudónimos e credenciais
export const DIRECT_IDENTIFIER_PATTERNS =
  /(user_?id|email|username|name|full_?name|cpf|ssn|phone|nif|bi|tax_?id|author)/i;

export const PSEUDO_IDENTIFIER_PATTERNS =
  /(session|cookie|token|device|ip_?address|ip|fingerprint|uuid|guid|tracker|client_?id)/i;

export const CREDENTIAL_PATTERNS =
  /(pass(word)?|secret|token|api_?key|auth|credential|jwt|bearer|private_?key)/i;

export const LOG_PATTERNS =
  /(log|logger|logging|audit|trace|telemetry|metrics)/i;

export const ANALYTICS_PATTERNS =
  /(analytic|tracking|profile|recommend|segment|behavior|event)/i;

export const FREE_TEXT_PATTERNS =
  /(comment|message|post|content|description|text|feedback|review|bio|note)/i;

/** Infere a sensibilidade dos dados com base em nomes de rotas, campos ou labels. */
export function inferDataType(label: string): string {
  if (CREDENTIAL_PATTERNS.test(label)) {
    return "credential";
  }
  if (DIRECT_IDENTIFIER_PATTERNS.test(label)) {
    return "direct_identifier";
  }
  if (PSEUDO_IDENTIFIER_PATTERNS.test(label)) {
    return "pseudo_identifier";
  }
  return "general_data";
}

/** Infere propriedades LINDDUN para nós do tipo 'process'. */
export function inferProcessProperties(
  name: string,
  filePath?: string,
  extraProps?: Record<string, unknown>,
  flowStrings: string[] = []
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    isWebApplication: true,
    isALog: false,
    storesCredentials: false,
    isEncrypted: true,
    builds_user_profiles: false,
    derives_patterns: false,
    stores_authenticated_identity: false,
    embeds_metadata: false,
    observable_side_effects: false,
    reveals_record_existence: false,
    performs_unnecessary_enrichment: false,
    lacks_preference_controls: false,
    lacks_legal_basis: false,
    deviates_from_privacy_standards: false,
    lacks_lifecycle_management: false,
  };

  const nameAndPath = `${name} ${filePath || ""}`;

  if (LOG_PATTERNS.test(nameAndPath)) {
    props.isALog = true;
    props.stores_authenticated_identity = true;
  }

  if (CREDENTIAL_PATTERNS.test(nameAndPath)) {
    props.storesCredentials = true;
  }

  if (ANALYTICS_PATTERNS.test(nameAndPath)) {
    props.builds_user_profiles = true;
    props.derives_patterns = true;
    props.performs_unnecessary_enrichment = true;
  }

  for (const routeStr of flowStrings) {
    if (CREDENTIAL_PATTERNS.test(routeStr)) {
      props.storesCredentials = true;
    }
    if (LOG_PATTERNS.test(routeStr)) {
      props.isALog = true;
    }
    if (ANALYTICS_PATTERNS.test(routeStr)) {
      props.builds_user_profiles = true;
      props.derives_patterns = true;
    }
  }

  if (extraProps) {
    Object.assign(props, extraProps);
  }

  return props;
}

/** Infere propriedades LINDDUN para nós do tipo 'data_store'. */
export function inferDatastoreProperties(
  name: string,
  technology?: string,
  tags: string[] = [],
  extraProps?: Record<string, unknown>
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    stores_raw_data: true,
    contains_pseudo_identifiers: false,
    contains_quasi_identifiers: false,
    re_identification_risk: false,
    isEncrypted: false,
    has_retention_policy: false,
    is_append_only: false,
    prevents_erasure: false,
    provides_user_access: false,
    provides_rectification_erasure: false,
  };

  const nameAndTech = `${name} ${technology || ""} ${tags.join(" ")}`;

  if (DIRECT_IDENTIFIER_PATTERNS.test(nameAndTech) || PSEUDO_IDENTIFIER_PATTERNS.test(nameAndTech)) {
    props.contains_pseudo_identifiers = true;
    props.contains_quasi_identifiers = true;
    props.re_identification_risk = true;
  }

  const lowerNameAndTech = nameAndTech.toLowerCase();
  if (tags.includes("cache") || lowerNameAndTech.includes("redis") || lowerNameAndTech.includes("memcached")) {
    props.has_retention_policy = true;
  }

  if (tags.includes("queue") || lowerNameAndTech.includes("kafka")) {
    props.is_append_only = true;
    props.prevents_erasure = true;
  }

  if (extraProps) {
    Object.assign(props, extraProps);
  }

  return props;
}

/** Infere propriedades LINDDUN para fluxos e arestas de dados. */
export function inferFlowProperties(
  label: string,
  operations: string[] = [],
  protocol: string = "",
  srcKind?: string,
  tgtKind?: string,
  extraFlowInfo?: string,
  extraProps?: Record<string, unknown>
): Record<string, unknown> {
  let isPublic = false;
  let direction = "inbound";

  const isExternal = (kind?: string) =>
    kind === "external_entity" || kind === "actor" || kind === "external";

  if (isExternal(srcKind)) {
    isPublic = true;
    direction = "inbound";
  } else if (isExternal(tgtKind)) {
    isPublic = true;
    direction = "outbound";
  }

  const protoLower = protocol.toLowerCase();
  const labelLower = label.toLowerCase();
  const isEncrypted =
    ["https", "tls", "ssl", "ssh"].includes(protoLower) ||
    labelLower.includes("https") ||
    labelLower.includes("tls");

  let labelFull = `${label} ${operations.join(" ")}`;
  if (extraFlowInfo) {
    labelFull += ` ${extraFlowInfo}`;
  }

  const dataType = inferDataType(labelFull);

  const props: Record<string, unknown> = {
    direction,
    data_type: dataType,
    publicNetwork: isPublic,
    isEncrypted,
    is_pseudonymized: false,
    isSigned: labelLower.includes("sign"),
    has_distinguishable_patterns: false,
    contains_inferable_identity: dataType === "direct_identifier" || dataType === "pseudo_identifier",
    accepts_free_form_text: FREE_TEXT_PATTERNS.test(labelFull),
    recycles_global_identifiers: false,
    generates_receipt_evidence: false,
    reveals_resource_existence: false,
    collects_excessive_sensitivity: false,
    high_collection_frequency: false,
    exposes_to_third_parties: isExternal(tgtKind),
    lacks_processing_notice: isPublic && direction === "inbound",
    shares_data_of_others: false,
  };

  if (extraProps) {
    Object.assign(props, extraProps);
  }

  return props;
}

/**
 * Converte e enriquece qualquer representação de DFD (canónica, Backend DfdGraph ou Frontend DfdModel)
 * para a estrutura canónica esperada pelo motor de regras LINDDUN.
 */
export function mapDfdToLinddun(dfd: unknown): CanonicalDfd {
  if (!dfd || typeof dfd !== "object") {
    return { repository: "unknown", elements: [], data_flows: [] };
  }

  const obj = dfd as Record<string, unknown>;

  // 1. Já está no formato canónico (CW685)
  if (Array.isArray(obj.elements) && Array.isArray(obj.data_flows)) {
    return {
      repository: typeof obj.repository === "string" ? obj.repository : "canonical-dfd",
      elements: (obj.elements as CanonicalElement[]).map((el) => ({
        ...el,
        properties: el.properties || {},
      })),
      data_flows: (obj.data_flows as CanonicalFlow[]).map((f) => ({
        ...f,
        properties: f.properties || {},
      })),
    };
  }

  // 2. Formato de Grafo (Backend DfdGraph ou Frontend DfdModel)
  const nodes = Array.isArray(obj.nodes) ? (obj.nodes as Array<Record<string, unknown>>) : [];
  const edges = Array.isArray(obj.edges) ? (obj.edges as Array<Record<string, unknown>>) : [];
  const extraFlows =
    obj.extra && typeof obj.extra === "object" && Array.isArray((obj.extra as Record<string, unknown>).flows)
      ? ((obj.extra as Record<string, unknown>).flows as Array<Record<string, unknown>>)
      : [];

  const nodesById = new Map<string, Record<string, unknown>>();
  for (const node of nodes) {
    const id = String(node.id ?? "");
    nodesById.set(id, node);
  }

  let repoName = "unknown";
  if (typeof obj.repository === "string") {
    repoName = obj.repository;
  } else if (obj.repository && typeof obj.repository === "object") {
    const r = obj.repository as Record<string, unknown>;
    repoName = `${r.owner || ""}/${r.repo || ""}`;
  }

  const elements: CanonicalElement[] = [];

  for (const node of nodes) {
    const id = String(node.id ?? "");
    const name = String(node.name || node.title || id);
    const kind = String(node.kind || "process").toLowerCase();
    const filePath = typeof node.path === "string" ? node.path : undefined;
    const technology = typeof node.technology === "string" ? node.technology : (typeof node.classification === "string" ? node.classification : undefined);
    const tags = Array.isArray(node.tags) ? (node.tags as string[]) : [];

    const extraProps =
      node.extra && typeof node.extra === "object" && (node.extra as Record<string, unknown>).properties
        ? ((node.extra as Record<string, unknown>).properties as Record<string, unknown>)
        : (node.properties && typeof node.properties === "object" ? (node.properties as Record<string, unknown>) : undefined);

    let targetType: string;
    let properties: Record<string, unknown>;

    if (kind === "process") {
      targetType = "process";
      const flowStrings: string[] = [];
      for (const flow of extraFlows) {
        if (flow.process === id || (filePath && typeof flow.file === "string" && flow.file.endsWith(filePath))) {
          flowStrings.push(`${flow.route || ""} ${flow.handler || ""}`);
        }
      }
      properties = inferProcessProperties(name, filePath, extraProps, flowStrings);
    } else if (kind === "data_store" || kind === "store") {
      targetType = "data_store";
      properties = inferDatastoreProperties(name, technology, tags, extraProps);
    } else {
      targetType = "actor";
      properties = {
        publicNetwork: true,
        shares_personal_data: true,
        ...(extraProps || {}),
      };
    }

    elements.push({
      id,
      name,
      type: targetType,
      technology,
      file_path: filePath,
      properties,
    });
  }

  const dataFlows: CanonicalFlow[] = [];
  const flowMap = new Map<string, Record<string, unknown>>();
  for (const flow of extraFlows) {
    if (flow.id) flowMap.set(String(flow.id), flow);
  }

  for (const edge of edges) {
    const edgeId = String(edge.id ?? "");
    const sourceId = String(edge.source ?? "");
    const targetId = String(edge.target ?? "");
    const label = String(edge.label ?? "");
    const protocol = String(edge.protocol ?? "");
    const operations = Array.isArray(edge.operations) ? (edge.operations as string[]) : [];

    const srcNode = nodesById.get(sourceId);
    const tgtNode = nodesById.get(targetId);
    const srcKind = srcNode ? String(srcNode.kind ?? "") : undefined;
    const tgtKind = tgtNode ? String(tgtNode.kind ?? "") : undefined;

    const associatedFlow = flowMap.get(edgeId);
    let extraFlowInfo: string | undefined;
    if (associatedFlow) {
      extraFlowInfo = `${associatedFlow.route || ""} ${associatedFlow.handler || ""} ${associatedFlow.method || ""}`;
    }

    const extraProps =
      edge.extra && typeof edge.extra === "object" && (edge.extra as Record<string, unknown>).properties
        ? ((edge.extra as Record<string, unknown>).properties as Record<string, unknown>)
        : (edge.properties && typeof edge.properties === "object" ? (edge.properties as Record<string, unknown>) : undefined);

    const properties = inferFlowProperties(
      label,
      operations,
      protocol,
      srcKind,
      tgtKind,
      extraFlowInfo,
      extraProps
    );

    dataFlows.push({
      id: edgeId,
      name: label,
      source: sourceId,
      target: targetId,
      properties,
      operations,
      protocol,
    });
  }

  return {
    repository: repoName,
    elements,
    data_flows: dataFlows,
  };
}
