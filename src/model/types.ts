export interface Position {
    x: number;
    y: number;
}

export interface TableNode {
    id: string;
    label: string;
    group: 'table';
    position?: Position;
    fixed?: {
        x: boolean;
        y: boolean;
    };
}

export interface ColumnNode {
    id: string;
    label: string;
    group: 'column';
    parent: string;
    position?: Position;
    physics: boolean;
    fixed?: {
        x: boolean;
        y: boolean;
    };
}

export interface Edge {
    id: string;
    from: string;
    to: string;
    label?: string;
    arrows?: string;
    smooth?: {
        type: string;
        roundness: number;
    };
}

export interface LineageData {
    nodes: (TableNode | ColumnNode)[];
    edges: Edge[];
}

export interface LineageState {
    data: LineageData;
    filePath?: string;
    isDirty: boolean;
}