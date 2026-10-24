import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OccupationalFunctionField } from "@/components/OccupationalFunctionField";

describe("unified occupational function", () => {
  it("uses the saved function ID and name when an existing function is chosen", () => {
    const onChange = vi.fn();
    render(<OccupationalFunctionField value="" functions={[{ id: "saved-driver", name: "Motorista" }]} onChange={onChange} onCreate={vi.fn()} busy={false} disabled={false} language="pt" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "motorista" } });
    expect(onChange).toHaveBeenCalledWith("Motorista", "saved-driver");
  });
  it("clears the old function ID when typing a new function and allows registration", () => {
    const onChange = vi.fn();
    const onCreate = vi.fn();
    render(<OccupationalFunctionField value="Supervisor" functions={[{ id: "saved-driver", name: "Motorista" }]} onChange={onChange} onCreate={onCreate} busy={false} disabled={false} language="pt" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Enfermeiro" } });
    expect(onChange).toHaveBeenCalledWith("Enfermeiro", "");
    fireEvent.click(screen.getByRole("button"));
    expect(onCreate).toHaveBeenCalledOnce();
  });
});