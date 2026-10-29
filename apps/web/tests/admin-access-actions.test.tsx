import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UserAccessAction } from "../modules/admin/users/user-access-action";
import { api, RequestError } from "../lib/api";
vi.mock("../lib/api", async (original) => ({
  ...(await original<typeof import("../lib/api")>()),
  api: vi.fn(),
}));
const user = {
  id: "user",
  name: "Alice",
  email: "alice@example.test",
  role: "STUDENT" as const,
  disabledAt: null,
  createdAt: "2026-01-01",
};
beforeEach(() => vi.clearAllMocks());
it("ne permet pas de suspendre ou réactiver un ADMIN", () => {
  render(
    <UserAccessAction user={{ ...user, role: "ADMIN" }} onChanged={vi.fn()} />,
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("annule et remet le focus sans mutation", () => {
  render(<UserAccessAction user={user} onChanged={vi.fn()} />);
  const trigger = screen.getByRole("button", { name: "Suspendre" });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
  expect(trigger).toHaveFocus();
  expect(api).not.toHaveBeenCalled();
});
it.each([false, true])(
  "exige motif, confirmation et actualise après succès (réactivation=%s)",
  async (enabled) => {
    const changed = vi.fn();
    vi.mocked(api).mockResolvedValueOnce({ ok: true });
    render(
      <UserAccessAction
        user={{ ...user, disabledAt: enabled ? "2026-01-01" : null }}
        onChanged={changed}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: enabled ? "Réactiver" : "Suspendre" }),
    );
    const submit = screen.getByRole("button", {
      name: enabled ? "Confirmer la réactivation" : "Confirmer la suspension",
    });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motif obligatoire"), {
      target: { value: "USER_REQUEST" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(submit);
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(api).toHaveBeenCalledWith("/admin/users/user", {
      method: "PATCH",
      body: JSON.stringify({
        disabled: !enabled,
        confirmed: true,
        reason: "USER_REQUEST",
      }),
    });
  },
);
it.each([401, 403, 409, 503])(
  "conserve le refus %s sans changement optimiste et revalide les permissions",
  async (status) => {
    const changed = vi.fn();
    vi.mocked(api).mockRejectedValueOnce(
      new RequestError("Refus " + status, "REFUSED", status),
    );
    render(<UserAccessAction user={user} onChanged={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "Suspendre" }));
    fireEvent.change(screen.getByLabelText("Motif obligatoire"), {
      target: { value: "POLICY_REVIEW" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer la suspension" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Refus " + status,
    );
    expect(changed).toHaveBeenCalledTimes(
      status === 401 || status === 403 ? 1 : 0,
    );
  },
);
