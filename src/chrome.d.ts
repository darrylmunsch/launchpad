// Chrome Extension API type declarations for the subset we use

declare namespace chrome {
  namespace bookmarks {
    interface BookmarkTreeNode {
      id: string;
      parentId?: string;
      index?: number;
      url?: string;
      title: string;
      dateAdded?: number;
      dateGroupModified?: number;
      children?: BookmarkTreeNode[];
    }

    interface CreateDetails {
      parentId?: string;
      index?: number;
      title?: string;
      url?: string;
    }

    interface MoveDestination {
      parentId?: string;
      index?: number;
    }

    interface UpdateChanges {
      title?: string;
      url?: string;
    }

    function getTree(): Promise<BookmarkTreeNode[]>;
    function get(id: string): Promise<BookmarkTreeNode[]>;
    function getChildren(id: string): Promise<BookmarkTreeNode[]>;
    function search(query: string): Promise<BookmarkTreeNode[]>;
    function create(bookmark: CreateDetails): Promise<BookmarkTreeNode>;
    function update(id: string, changes: UpdateChanges): Promise<BookmarkTreeNode>;
    function move(id: string, destination: MoveDestination): Promise<BookmarkTreeNode>;
    function remove(id: string): Promise<void>;
    function removeTree(id: string): Promise<void>;

    const onCreated: {
      addListener(callback: (id: string, bookmark: BookmarkTreeNode) => void): void;
    };
    const onRemoved: {
      addListener(callback: (id: string, removeInfo: { parentId: string; index: number }) => void): void;
    };
    const onChanged: {
      addListener(callback: (id: string, changeInfo: { title: string; url?: string }) => void): void;
    };
    const onMoved: {
      addListener(callback: (id: string, moveInfo: { parentId: string; oldParentId: string; index: number; oldIndex: number }) => void): void;
    };
  }

  namespace storage {
    interface StorageArea {
      get(keys: string | string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    }
    interface StorageChange {
      oldValue?: unknown;
      newValue?: unknown;
    }
    const local: StorageArea;
    const onChanged: {
      addListener(callback: (changes: Record<string, StorageChange>, areaName: string) => void): void;
    };
  }

  namespace runtime {
    const id: string;
    function getURL(path: string): string;
    function getManifest(): {
      version: string;
      name: string;
      [key: string]: unknown;
    };
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
      status?: string;
    }

    interface CreateProperties {
      url?: string;
      active?: boolean;
    }

    interface QueryInfo {
      url?: string | string[];
      status?: string;
    }

    function create(createProperties: CreateProperties): Promise<unknown>;
    function query(queryInfo: QueryInfo): Promise<Tab[]>;

    const onUpdated: {
      addListener(callback: (tabId: number, changeInfo: { status?: string; url?: string; title?: string }, tab: Tab) => void): void;
    };
  }

  namespace scripting {
    interface ScriptInjection {
      target: { tabId: number };
      func: (...args: unknown[]) => void;
      args?: unknown[];
    }
    function executeScript(injection: ScriptInjection): Promise<unknown>;
  }

  namespace windows {
    interface CreateData {
      url?: string;
      incognito?: boolean;
    }
    function create(createData: CreateData): Promise<unknown>;
  }
}
