import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders Available status", () => {
    render(<StatusBadge status="Available" />);
    expect(screen.getByText("Available")).toBeInTheDocument();
  });
  it("renders Borrowed status", () => {
    render(<StatusBadge status="Borrowed" />);
    expect(screen.getByText("Borrowed")).toBeInTheDocument();
  });
  it("renders Lapsed status", () => {
    render(<StatusBadge status="Lapsed" />);
    expect(screen.getByText("Lapsed")).toBeInTheDocument();
  });
});
