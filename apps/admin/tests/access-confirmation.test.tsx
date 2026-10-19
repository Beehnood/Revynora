import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AccessConfirmation } from "../modules/users/access-confirmation";
it("exige motif et confirmation, puis transmet uniquement le contrat autorisé", async () => {
  const onConfirm = vi.fn().mockResolvedValue(undefined),
    onCancel = vi.fn();
  render(
    <AccessConfirmation
      name="Alice"
      disabled
      busy={false}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />,
  );
  const submit = screen.getByRole("button", {
    name: "Confirmer la suspension",
  });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Motif obligatoire"), {
    target: { value: "USER_REQUEST" },
  });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(submit);
  await waitFor(() =>
    expect(onConfirm).toHaveBeenCalledWith({
      disabled: true,
      confirmed: true,
      reason: "USER_REQUEST",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
  expect(onCancel).toHaveBeenCalledOnce();
});

it("ne soumet qu’une commande lorsque l’opérateur clique deux fois pendant la requête", async () => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const onConfirm = vi.fn(() => pending);
  render(
    <AccessConfirmation
      name="Alice"
      disabled
      busy={false}
      onCancel={() => {}}
      onConfirm={onConfirm}
    />,
  );
  fireEvent.change(screen.getByLabelText("Motif obligatoire"), {
    target: { value: "USER_REQUEST" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  const button = screen.getByRole("button", {
    name: "Confirmer la suspension",
  });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(onConfirm).toHaveBeenCalledOnce();
  release();
  await pending;
});
