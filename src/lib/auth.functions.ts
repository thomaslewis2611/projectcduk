import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdmin } from "@/lib/admin.server";

export const checkIsAdmin = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string().nullable() }))
  .handler(async ({ data }): Promise<boolean> => isAdmin(data.accessToken));
