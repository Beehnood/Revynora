import { DomainError } from "../../shared/domain/errors";
export type CatalogQuery = { page: number; search: string };
export function checkedCatalogQuery(query: CatalogQuery) {
  if (
    !Number.isInteger(query.page) ||
    query.page < 1 ||
    query.page > 10000 ||
    query.search.length > 100
  )
    throw new DomainError(
      400,
      "VALIDATION",
      "Recherche de catalogue invalide.",
    );
  return query;
}
export function literalSearch(value: string) {
  return "%" + value.replace(/[\\%_]/g, "\\$&") + "%";
}
export function checkedCatalogText(row: {
  title: string;
  domain: string;
  content?: string;
}) {
  if (
    !row.title.trim() ||
    row.title.length > 160 ||
    !row.domain.trim() ||
    row.domain.length > 80 ||
    (row.content?.length ?? 0) > 10000
  )
    throw new DomainError(
      422,
      "CATALOG_LIMIT",
      "Ce cours dépasse les limites de consultation du catalogue.",
    );
  return row;
}
