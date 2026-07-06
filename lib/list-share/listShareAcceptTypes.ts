export type ListSharePreviewClient = {
  id: string;
  listId: string;
  listTitle: string;
  openItemCount: number;
  sourceWorkspaceName: string;
  sharerName: string;
  recipientEmail: string | null;
  isValid: boolean;
  invalidReason?: string;
};

export type ListShareWorkspaceOption = {
  id: string;
  name: string;
  alreadyLinked: boolean;
};

export type ListShareAcceptResult = {
  listId: string;
  targetWorkspaceId: string;
};
