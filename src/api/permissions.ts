import { http } from "./http";

export interface AccessObjectPermission {
  object_key: string;
  object_type: string;
  label?: string | null;
  can_view: boolean;
  can_approve?: boolean;
  can_export?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  priority?: number | null;
}

export interface AccessPermissionScope {
  user?: string | null;
  company?: string | null;
  territory?: string | null;
  branch?: string | null;
}

export interface GetMyAccessResponse {
  scope?: AccessPermissionScope;
  profiles: AccessObjectPermission[];
}

export async function getMyAccess(
  scope?: Partial<AccessPermissionScope>
): Promise<GetMyAccessResponse> {
  const sanitizedScope: Partial<AccessPermissionScope> = {
    ...scope,
    territory: scope?.territory ?? undefined,
  };

  const response = await http.post<{
    message?: GetMyAccessResponse;
    profiles?: AccessObjectPermission[];
    scope?: AccessPermissionScope;
  }>("/api/method/printechs_utility.api.get_my_access", sanitizedScope);

  const payload =
    response.message ?? {
      profiles: response.profiles ?? [],
      scope: response.scope,
    };

  return {
    profiles: payload?.profiles ?? [],
    scope: payload?.scope,
  };
}

export async function clearMyAccessCache(user?: string): Promise<void> {
  await http.get("/api/method/printechs_utility.api.clear_my_access_cache", {
    user,
  });
}

