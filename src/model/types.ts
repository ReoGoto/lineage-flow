export interface Position {
    x: number;
    y: number;
}

export interface TableDefinition {
    id: string;
    name: string;
    position?: Position;
    columns: ColumnDefinition[];
}

export interface ColumnDefinition {
    id: string;
    name: string;
    position?: Position;
}

export interface LineageDefinition {
    id: string;
    source: string;
    target: string;
    description?: string;
    color?: string;
    style?: 'solid' | 'dashed' | 'dotted';
    arrows?: string;
}

export interface LineageConfig {
    layout_version?: string;
    theme?: 'light' | 'dark';
    layout?: {
        direction?: 'LR' | 'RL' | 'UD' | 'DU';
        nodeSpacing?: number;
        levelSpacing?: number;
    };
}

export interface LineageData {
    tables: TableDefinition[];
    lineage: LineageDefinition[];
    config?: LineageConfig;
}

// Internal types for vis.js Network
export interface VisNode {
    id: string;
    label: string;
    group: 'table' | 'column';
    parent?: string;
    physics: boolean;
    fixed?: {
        x: boolean;
        y: boolean;
    };
    position?: Position;
}

export interface VisEdge {
    id: string;
    from: string;
    to: string;
    label?: string;
    color?: string;
    style?: 'solid' | 'dashed' | 'dotted';
    arrows?: string;
    smooth?: {
        type: string;
        roundness: number;
    };
}

export interface VisData {
    nodes: VisNode[];
    edges: VisEdge[];
}

// History management types
export interface HistoryEntry {
    data: LineageData;
    timestamp: number;
    description: string;
}

export interface HistoryState {
    entries: HistoryEntry[];
    currentIndex: number;
    maxEntries: number;
}

export interface LineageState {
    data: LineageData;
    filePath?: string;
    isDirty: boolean;
}