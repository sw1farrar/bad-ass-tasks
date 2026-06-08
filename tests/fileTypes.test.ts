import { describe, it, expect } from "vitest";
import { inferRecordTypeFromMime, inferRecordTypeFromTags } from "@/lib/files/fileTypes";

describe("fileTypes", () => {
  it("infers email from from-email tag", () => {
    expect(inferRecordTypeFromTags(["from-email", "inbox"])).toBe("email");
  });

  it("defaults tags to note", () => {
    expect(inferRecordTypeFromTags(["strategy"])).toBe("note");
  });

  it("classifies PDF uploads as document", () => {
    expect(inferRecordTypeFromMime("application/pdf")).toBe("document");
  });

  it("classifies images as document", () => {
    expect(inferRecordTypeFromMime("image/png")).toBe("document");
  });
});