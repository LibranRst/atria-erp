export type AdministrationTab = "USERS" | "VENDORS" | "ROLES";
export type EditorMode = "NEW_USER" | "EDIT_USER" | "NEW_VENDOR" | "EDIT_VENDOR" | null;

export type UserFormState = {
  readonly name: string;
  readonly email: string;
  readonly roleId: string;
  readonly temporaryPassword: string;
};

export type VendorFormState = {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly bankName: string;
  readonly bankAccountNumber: string;
  readonly bankAccountHolder: string;
};
