import { z } from "zod";

export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/);
export const managedUserSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(2).max(120),
  companyId: z.string().uuid(),
  password: z.string().min(8).max(72),
  active: z.boolean(),
});
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1), password: z.string().min(8).max(72) })
  .refine((value) => value.currentPassword !== value.password, { message: "Escolha uma senha diferente da inicial.", path: ["password"] });
export function canManageUsers(isMaster: boolean, isActive: boolean) { return isMaster && isActive; }

export const managedUserEditSchema = managedUserSchema.omit({ password: true, active: true }).extend({
  userId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
});

export function canDeleteManagedUser(actorId: string, targetId: string, targetIsMaster: boolean) {
  return actorId !== targetId && !targetIsMaster;
}