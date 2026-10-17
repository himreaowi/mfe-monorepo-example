/**
 * apiRoutes pattern (from starter-mfe): keep relative API paths in one typed object per
 * feature/app and join them with the client's base URL at call time.
 *
 * ```ts
 * export const apiRoutes = defineApiRoutes({
 *   posts: { byId: (id: number | string) => `/posts/${id}` },
 * });
 * const post = await http.getJson<Post>(apiRoutes.posts.byId(1));
 * ```
 */
export function defineApiRoutes<const T extends object>(routes: T): T {
  return routes;
}
