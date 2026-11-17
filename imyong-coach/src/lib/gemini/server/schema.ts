import "server-only";
import { z } from "zod";

/**
 * Gemini responseJsonSchema가 지원하는 키워드만 남깁니다.
 * (출처: @google/genai 3.4.0 GenerateContentConfig.responseJsonSchema 문서)
 * 지원하지 않는 키워드(pattern, $schema, const, minLength 등)는 제거하고,
 * 그 제약은 응답을 받은 뒤 zod로 다시 검증합니다.
 */
const ALLOWED_KEYS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function sanitize(node: Json): Json {
  if (Array.isArray(node)) return node.map(sanitize);
  if (node === null || typeof node !== "object") return node;

  const out: { [k: string]: Json } = {};
  for (const [key, value] of Object.entries(node)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      // properties의 키는 필드 이름이므로 키 자체는 필터링하지 않고 값만 정리
      out.properties = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v)]));
      // 필드 순서를 명시 → 모델이 관찰(구간·문항) → 점수 → 총평 순으로 생성
      out.propertyOrdering = Object.keys(value);
      continue;
    }
    if (key === "$defs" && value && typeof value === "object" && !Array.isArray(value)) {
      out.$defs = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v)]));
      continue;
    }
    // 매우 큰 정수 경계(Number.MAX_SAFE_INTEGER 등)는 의미가 없으므로 제거
    if ((key === "minimum" || key === "maximum") && typeof value === "number" && Math.abs(value) > 1e12) continue;
    out[key] = sanitize(value);
  }
  return out;
}

export function toGeminiJsonSchema(schema: z.ZodType): Json {
  return sanitize(z.toJSONSchema(schema) as Json);
}
