import { describe, expect, it } from "vitest";
import { handleMcpMessage, isJsonRpcNotification } from "@/lib/mcp/protocol";
import { listMcpToolDescriptors } from "@/lib/mcp/tools";

describe("mcp protocol", () => {
  it("treats messages without id as notifications", () => {
    expect(isJsonRpcNotification({ jsonrpc: "2.0", method: "notifications/initialized" })).toBe(
      true,
    );
    expect(isJsonRpcNotification({ jsonrpc: "2.0", id: 1, method: "ping" })).toBe(false);
  });

  it("initializes with tools capability", async () => {
    const response = await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "grok" } },
      },
      "user-1",
    );
    expect(response?.result).toMatchObject({
      protocolVersion: "2025-03-26",
      serverInfo: { name: "badazz-tasks" },
      capabilities: { tools: { listChanged: false } },
    });
  });

  it("lists write tools grok can use after login", () => {
    const names = listMcpToolDescriptors().map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "whoami",
        "list_workspaces",
        "list_tasks",
        "create_task",
        "update_task",
        "complete_task",
        "delete_task",
        "create_note",
        "update_note",
        "add_list_item",
        "complete_list_item",
      ]),
    );
  });

  it("returns an error result for unknown tools", async () => {
    const response = await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "drop_database", arguments: {} },
      },
      "user-1",
    );
    expect(response?.result).toMatchObject({
      isError: true,
      content: [{ type: "text", text: "Unknown tool: drop_database" }],
    });
  });

  it("lets token-only hosts complete the handshake without a login", async () => {
    const init = await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "grokbot" } },
      },
      null,
    );
    expect(init?.result).toMatchObject({ serverInfo: { name: "badazz-tasks" } });

    const listed = await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, null);
    expect((listed?.result as { tools?: unknown[] })?.tools?.length).toBeGreaterThan(0);

    const call = await handleMcpMessage(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "whoami", arguments: {} } },
      null,
    );
    expect(call?.result).toMatchObject({ isError: true });
  });

  it("ignores initialized notifications", async () => {
    const response = await handleMcpMessage(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      "user-1",
    );
    expect(response).toBeNull();
  });
});
