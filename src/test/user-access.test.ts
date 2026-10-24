import { describe, expect, it } from "vitest";
import { canManageUsers, managedUserSchema, passwordChangeSchema, usernameSchema } from "@/lib/user-access";

describe("user access rules", () => {
  it("only an active master can administer users", () => {
    expect(canManageUsers(true, true)).toBe(true);
    expect(canManageUsers(false, true)).toBe(false);
    expect(canManageUsers(true, false)).toBe(false);
  });
  it("requires a real email and company on creation", () => {
    const data = {username: "ivo.silva", email: "ivo@example.org", fullName: "Ivo Silva", companyId: "12345678-1234-4234-8234-123456789abc", password: "initial-password", active: true};
    expect(managedUserSchema.safeParse(data).success).toBe(true);
    expect(managedUserSchema.safeParse({...data,email:"ivo"}).success).toBe(false);
    expect(managedUserSchema.safeParse({...data,companyId:""}).success).toBe(false);
  });
  it("normalizes username independently of email", () => {
    expect(usernameSchema.parse(" Ivo.Silva ")).toBe("ivo.silva");
    expect(usernameSchema.safeParse("ivo@example.org").success).toBe(false);
  });
  it("requires current password and a different new password", () => {
    expect(passwordChangeSchema.safeParse({currentPassword:"initial-password",password:"new-password"}).success).toBe(true);
    expect(passwordChangeSchema.safeParse({currentPassword:"initial-password",password:"initial-password"}).success).toBe(false);
    expect(passwordChangeSchema.safeParse({currentPassword:"",password:"new-password"}).success).toBe(false);
  });
});