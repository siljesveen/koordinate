export type AppRole = "admin" | "planlegger" | "visning";

export type UserProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: AppRole;
};

export function roleLabel(role: AppRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "planlegger":
      return "Planlegger";
    case "visning":
      return "Visning";
  }
}

export function canEditData(role: AppRole): boolean {
  return role === "admin" || role === "planlegger";
}

export function isAdmin(role: AppRole): boolean {
  return role === "admin";
}

export function canEditMasterdata(role: AppRole): boolean {
  return isAdmin(role);
}
