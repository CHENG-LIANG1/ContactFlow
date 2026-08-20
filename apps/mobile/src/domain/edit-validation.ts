import type { ActionProposal } from "@/domain/actions";

export type EditFieldError =
  | "required"
  | "email"
  | "phone"
  | "endAfterStart";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s()-]+$/;

function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return (
    PHONE_PATTERN.test(value) && digits.length >= 3 && digits.length <= 15
  );
}

/**
 * Validates editable draft values keyed by card field key, mirroring the
 * payload schemas so a committed draft always stays executable.
 */
export function validateActionEdit(
  action: ActionProposal,
  values: Record<string, string>,
): Record<string, EditFieldError> {
  const errors: Record<string, EditFieldError> = {};
  const text = (key: string) => (values[key] ?? "").trim();
  const requireText = (key: string) => {
    if (text(key).length === 0) errors[key] = "required";
  };
  const checkEmail = (key: string) => {
    const value = text(key);
    if (value.length > 0 && !EMAIL_PATTERN.test(value)) errors[key] = "email";
  };

  if (action.type === "create_meeting") {
    requireText("title");
    const start = Date.parse(values.startAt ?? "");
    const end = Date.parse(values.endAt ?? "");
    if (!(end > start)) errors.endAt = "endAfterStart";
    return errors;
  }

  if (action.type === "create_contact") {
    requireText("name");
    if (text("phone").length === 0) errors.phone = "required";
    else if (!isPhone(text("phone"))) errors.phone = "phone";
    checkEmail("email");
    return errors;
  }

  requireText("company");
  requireText("jobTitle");
  checkEmail("email");
  return errors;
}
