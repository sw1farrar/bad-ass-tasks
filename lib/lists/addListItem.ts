export type AddListItemOptions = {
  parentItemId?: string | null;
  afterItemId?: string;
};

export type OnAddListItem = (
  listId: string,
  text: string,
  options?: AddListItemOptions,
) => Promise<string | null> | string | null | void;