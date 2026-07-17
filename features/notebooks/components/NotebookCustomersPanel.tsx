"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, Plus, Search, Trash2 } from "lucide-react";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { NotebookCustomer, NotebookCustomerNote, WorkspaceMember } from "@/types";
import { NotebookProgressComposer } from "./NotebookProgressComposer";
import { NotebookProgressTimeline } from "./NotebookProgressTimeline";

interface NotebookCustomersPanelProps {
  customers: NotebookCustomer[];
  notes: NotebookCustomerNote[];
  members: WorkspaceMember[];
  currentUserId?: string;
  selectedCustomerId: string | null;
  onSelectCustomer: (id: string | null) => void;
  onAddCustomer: (accountName: string) => void | Promise<unknown>;
  onUpdateCustomer: (id: string, accountName: string) => void | Promise<unknown>;
  onRequestDeleteCustomer: (id: string) => void;
  onAddNote: (customerId: string, body: string) => void | Promise<unknown>;
  onUpdateNote: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteNote: (id: string) => void;
}

export function NotebookCustomersPanel({
  customers,
  notes,
  members,
  currentUserId,
  selectedCustomerId,
  onSelectCustomer,
  onAddCustomer,
  onUpdateCustomer,
  onRequestDeleteCustomer,
  onAddNote,
  onUpdateNote,
  onRequestDeleteNote,
}: NotebookCustomersPanelProps) {
  const isMobile = useIsMobileViewport();
  const [searchQuery, setSearchQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.accountName.toLowerCase().includes(q));
  }, [customers, searchQuery]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  const customerNotes = useMemo(
    () =>
      selectedCustomerId
        ? notes.filter((n) => n.customerId === selectedCustomerId)
        : [],
    [notes, selectedCustomerId],
  );

  const handleAdd = async () => {
    const name = customerName.trim();
    if (!name) {
      toast.error("Customer name is required");
      return;
    }
    setIsAdding(true);
    try {
      await onAddCustomer(name);
      setCustomerName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add customer");
    } finally {
      setIsAdding(false);
    }
  };

  const showMobileDetail = isMobile && !!selectedCustomer;

  return (
    <div className="notebooks-section-panel flex flex-1 min-h-0 min-w-0">
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 shrink-0 flex flex-col min-h-0 border-r border-border-glass bg-bg",
          showMobileDetail && "hidden",
        )}
      >
        <div className="shrink-0 p-3 border-b border-border-glass space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customers…"
              className="w-full bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd();
              }}
              placeholder="Customer name"
              className="flex-1 min-w-0 bg-bg-secondary border border-border-glass rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={isAdding || !customerName.trim()}
              className="shrink-0 flex items-center justify-center gap-1.5 rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-3 py-2 text-sm font-medium text-neon-purple-tint disabled:opacity-40 min-h-[40px]"
              aria-label="Add customer"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {filteredCustomers.length === 0 ? (
            <p className="text-sm text-text-muted px-4 py-6 text-center">
              {searchQuery.trim() ? "No customers match your search." : "No customers yet."}
            </p>
          ) : (
            <ul className="py-1">
              {filteredCustomers.map((customer) => {
                const isSelected = selectedCustomerId === customer.id;
                return (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCustomer(customer.id)}
                    className={cn(
                      "files-list-item w-full text-left px-3 py-2.5 transition relative",
                      isSelected && "files-list-item--selected",
                      !isSelected && "hover:bg-surface-hover",
                    )}
                    aria-selected={isSelected}
                  >
                    <div className="text-sm font-medium truncate text-text-primary relative z-[1]">
                      {customer.accountName}
                    </div>
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex-1 flex-col min-h-0 min-w-0",
          selectedCustomer ? "flex" : "hidden md:flex",
        )}
      >
        {selectedCustomer ? (
          <>
            {isMobile && (
              <div className="shrink-0 px-2 py-2 border-b border-border-glass flex items-center">
                <button
                  type="button"
                  onClick={() => onSelectCustomer(null)}
                  className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover min-h-[44px]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Customers
                </button>
              </div>
            )}
            <div className="shrink-0 px-4 py-3 border-b border-border-glass flex items-center gap-2">
              <input
                defaultValue={selectedCustomer.accountName}
                key={selectedCustomer.id}
                onBlur={async (e) => {
                  const raw = e.target.value.trim();
                  if (!raw) {
                    e.target.value = selectedCustomer.accountName;
                    return;
                  }
                  if (raw === selectedCustomer.accountName) return;
                  try {
                    await onUpdateCustomer(selectedCustomer.id, raw);
                  } catch (err) {
                    e.target.value = selectedCustomer.accountName;
                    toast.error(err instanceof Error ? err.message : "Could not update customer");
                  }
                }}
                className="flex-1 min-w-0 bg-transparent text-lg font-semibold focus:outline-none text-text-primary"
                aria-label="Customer name"
              />
              <button
                type="button"
                onClick={() => onRequestDeleteCustomer(selectedCustomer.id)}
                className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
                aria-label="Delete customer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <NotebookProgressTimeline
                entries={customerNotes}
                members={members}
                currentUserId={currentUserId}
                emptyMessage="No notes for this customer yet."
                onUpdateEntry={onUpdateNote}
                onRequestDeleteEntry={onRequestDeleteNote}
              />
            </div>
            <NotebookProgressComposer
              placeholder="Add a customer note…"
              onSubmit={async (body) => {
                await onAddNote(selectedCustomer.id, body);
              }}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-text-muted p-8 text-center">
            Select a customer to view and add notes.
          </div>
        )}
      </div>
    </div>
  );
}