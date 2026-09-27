import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ChipInput } from "@/components/ChipInput";

function Harness({ initial = [] as string[], suggestions = [] as string[] }) {
  const [values, setValues] = useState(initial);
  return (
    <>
      <ChipInput values={values} onChange={setValues} suggestions={suggestions} aria-label="Ingredients" />
      <output data-testid="values">{values.join("|")}</output>
    </>
  );
}

const values = () => screen.getByTestId("values").textContent;

describe("ChipInput", () => {
  it("adds chips with Enter and comma, skipping duplicates", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Ingredients" });
    await user.type(input, "rice{Enter}Onion,rice{Enter}");
    expect(values()).toBe("rice|Onion");
  });

  it("removes the last chip with Backspace and a chip with its button", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["eggs", "milk", "flour"]} />);
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Backspace}");
    expect(values()).toBe("eggs|milk");
    await user.click(screen.getByRole("button", { name: "Remove eggs" }));
    expect(values()).toBe("milk");
  });

  it("adds every item from a pasted list", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("combobox"));
    await user.paste("salt, pepper\ncumin");
    expect(values()).toBe("salt|pepper|cumin");
  });

  it("picks suggestions with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness suggestions={["chicken", "chickpea"]} />);
    await user.type(screen.getByRole("combobox"), "chi");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(values()).toBe("chickpea");
  });
});
