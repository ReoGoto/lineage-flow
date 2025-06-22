import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import {
    LineageData,
    LineageState,
    TableDefinition,
    ColumnDefinition,
    LineageDefinition,
    Position,
    VisData,
    VisNode,
    VisEdge,
    HistoryState
} from './types';

export class LineageDataManager {
    private state: LineageState;
    private history: HistoryState;
    private static instance: LineageDataManager;

    private constructor() {
        this.state = {
            data: {
                tables: [],
                lineage: [],
                config: {
                    layout_version: "1.0",
                    layout: {
                        direction: "LR",
                        nodeSpacing: 150,
                        levelSpacing: 200
                    }
                }
            },
            isDirty: false
        };

        this.history = {
            entries: [],
            currentIndex: -1,
            maxEntries: 50
        };
    }

    public static getInstance(): LineageDataManager {
        if (!LineageDataManager.instance) {
            LineageDataManager.instance = new LineageDataManager();
        }
        return LineageDataManager.instance;
    }

    private addHistoryEntry(description: string): void {
        // Remove any future history entries if we're not at the latest state
        if (this.history.currentIndex < this.history.entries.length - 1) {
            this.history.entries = this.history.entries.slice(0, this.history.currentIndex + 1);
        }

        // Add new entry
        this.history.entries.push({
            data: JSON.parse(JSON.stringify(this.state.data)), // Deep copy
            timestamp: Date.now(),
            description
        });

        // Remove oldest entries if we exceed maxEntries
        if (this.history.entries.length > this.history.maxEntries) {
            this.history.entries = this.history.entries.slice(
                this.history.entries.length - this.history.maxEntries
            );
        }

        this.history.currentIndex = this.history.entries.length - 1;
    }

    public canUndo(): boolean {
        return this.history.currentIndex > 0;
    }

    public canRedo(): boolean {
        return this.history.currentIndex < this.history.entries.length - 1;
    }

    public undo(): boolean {
        if (!this.canUndo()) {
            return false;
        }

        this.history.currentIndex--;
        this.state.data = JSON.parse(
            JSON.stringify(this.history.entries[this.history.currentIndex].data)
        );
        return true;
    }

    public redo(): boolean {
        if (!this.canRedo()) {
            return false;
        }

        this.history.currentIndex++;
        this.state.data = JSON.parse(
            JSON.stringify(this.history.entries[this.history.currentIndex].data)
        );
        return true;
    }

    public async importFromCsv(): Promise<void> {
        // Show file picker
        const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'CSV files': ['csv']
            },
            title: 'Select CSV file with table and column definitions'
        });

        if (!files || files.length === 0) {
            return;
        }

        const csvFile = files[0];
        const csvContent = await fs.promises.readFile(csvFile.fsPath, 'utf-8');
        
        // Parse CSV content
        const records = await new Promise<any[]>((resolve, reject) => {
            parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            }, (err, output) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(output);
                }
            });
        });

        // Group records by table
        const tableGroups = new Map<string, string[]>();
        for (const record of records) {
            const tableName = record.table_name;
            const columnName = record.column_name;

            if (!tableName || !columnName) {
                continue;
            }

            if (!tableGroups.has(tableName)) {
                tableGroups.set(tableName, []);
            }
            tableGroups.get(tableName)!.push(columnName);
        }

        // Convert to TableDefinitions
        let xOffset = 0;
        const tables: TableDefinition[] = [];

        for (const [tableName, columnNames] of tableGroups) {
            const tableId = 'T' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const columns: ColumnDefinition[] = columnNames.map(name => ({
                id: 'C' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: name
            }));

            tables.push({
                id: tableId,
                name: tableName,
                position: { x: xOffset, y: 0 },
                columns: columns
            });

            xOffset += 300; // Space tables horizontally
        }

        // Update state
        this.state.data.tables = this.state.data.tables.concat(tables);
        this.addHistoryEntry('Import CSV data');
    }

    public async saveToJson(): Promise<void> {
        if (!this.state.filePath) {
            const file = await vscode.window.showSaveDialog({
                filters: {
                    'JSON files': ['json']
                },
                title: 'Save Lineage Data'
            });

            if (!file) {
                return;
            }

            this.state.filePath = file.fsPath;
        }

        await fs.promises.writeFile(
            this.state.filePath,
            JSON.stringify(this.state.data, null, 2),
            'utf-8'
        );
    }

    public async loadFromJson(): Promise<void> {
        const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'JSON files': ['json']
            },
            title: 'Load Lineage Data'
        });

        if (!files || files.length === 0) {
            return;
        }

        const jsonFile = files[0];
        const jsonContent = await fs.promises.readFile(jsonFile.fsPath, 'utf-8');
        this.state.data = JSON.parse(jsonContent);
        this.state.filePath = jsonFile.fsPath;
        this.addHistoryEntry('Load from JSON');
    }

    public updateTablePosition(tableId: string, position: Position): void {
        const table = this.state.data.tables.find(t => t.id === tableId);
        if (table) {
            table.position = position;
            this.addHistoryEntry(`Move table ${table.name}`);
        }
    }

    public updateColumnPosition(tableId: string, columnId: string, position: Position): void {
        const table = this.state.data.tables.find(t => t.id === tableId);
        if (table) {
            const column = table.columns.find(c => c.id === columnId);
            if (column) {
                column.position = position;
                this.addHistoryEntry(`Move column ${column.name}`);
            }
        }
    }

    public updateTableName(tableId: string, newName: string): void {
        const table = this.state.data.tables.find(t => t.id === tableId);
        if (table) {
            table.name = newName;
            this.addHistoryEntry(`Rename table to ${newName}`);
        }
    }

    public updateColumnName(tableId: string, columnId: string, newName: string): void {
        const table = this.state.data.tables.find(t => t.id === tableId);
        if (table) {
            const column = table.columns.find(c => c.id === columnId);
            if (column) {
                column.name = newName;
                this.addHistoryEntry(`Rename column to ${newName}`);
            }
        }
    }

    public addLineage(lineage: LineageDefinition): void {
        this.state.data.lineage.push(lineage);
        this.addHistoryEntry('Add lineage connection');
    }

    public removeLineage(lineageId: string): void {
        this.state.data.lineage = this.state.data.lineage.filter(l => l.id !== lineageId);
        this.addHistoryEntry('Remove lineage connection');
    }

    public updateLineage(lineageId: string, updates: Partial<LineageDefinition>): void {
        const lineage = this.state.data.lineage.find(l => l.id === lineageId);
        if (lineage) {
            Object.assign(lineage, updates);
            this.addHistoryEntry('Update lineage properties');
        }
    }

    public getVisData(): VisData {
        const nodes: VisNode[] = [];
        const edges: VisEdge[] = [];

        // Convert tables and columns to nodes
        for (const table of this.state.data.tables) {
            // Add table node
            nodes.push({
                id: table.id,
                label: table.name,
                group: 'table',
                physics: true,
                fixed: { x: false, y: false },
                position: table.position
            });

            // Add column nodes
            for (const column of table.columns) {
                nodes.push({
                    id: column.id,
                    label: column.name,
                    group: 'column',
                    parent: table.id,
                    physics: false,
                    fixed: { x: true, y: true },
                    position: column.position
                });
            }
        }

        // Convert lineage to edges
        for (const lineage of this.state.data.lineage) {
            edges.push({
                id: lineage.id,
                from: lineage.source,
                to: lineage.target,
                label: lineage.description,
                color: lineage.color,
                style: lineage.style,
                arrows: lineage.arrows || 'to',
                smooth: {
                    type: 'curvedCW',
                    roundness: 0.2
                }
            });
        }

        return { nodes, edges };
    }

    public getData(): LineageData {
        return this.state.data;
    }

    public isDirty(): boolean {
        return this.state.isDirty;
    }
}
