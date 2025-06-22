import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';
import { LineageData, LineageState, TableNode, ColumnNode, Edge, Position } from './types';

export class LineageDataManager {
    private state: LineageState;
    private static instance: LineageDataManager;

    private constructor() {
        this.state = {
            data: {
                nodes: [],
                edges: []
            },
            isDirty: false
        };
    }

    public static getInstance(): LineageDataManager {
        if (!LineageDataManager.instance) {
            LineageDataManager.instance = new LineageDataManager();
        }
        return LineageDataManager.instance;
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
        const records = csv.parse(csvContent, {
            columns: true,
            skip_empty_lines: true
        });

        // Convert records to nodes
        const nodes: (TableNode | ColumnNode)[] = [];
        const tableMap = new Map<string, TableNode>();
        let xOffset = 0;

        for (const record of records) {
            const tableName = record.table_name;
            const columnName = record.column_name;

            if (!tableName || !columnName) {
                continue;
            }

            // Create or get table node
            let tableNode = tableMap.get(tableName);
            if (!tableNode) {
                const tableId = 'T' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                tableNode = {
                    id: tableId,
                    label: tableName,
                    group: 'table',
                    position: { x: xOffset, y: 0 },
                    fixed: { x: false, y: false }
                };
                tableMap.set(tableName, tableNode);
                nodes.push(tableNode);
                xOffset += 300; // Space tables horizontally
            }

            // Create column node
            const columnId = 'C' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const columnNode: ColumnNode = {
                id: columnId,
                label: columnName,
                group: 'column',
                parent: tableNode.id,
                physics: false,
                fixed: { x: true, y: true }
            };
            nodes.push(columnNode);
        }

        // Update state
        this.state.data.nodes = this.state.data.nodes.concat(nodes);
        this.state.isDirty = true;
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
        this.state.isDirty = false;
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
        this.state.isDirty = false;
    }

    public updateNodePosition(nodeId: string, position: Position): void {
        const node = this.state.data.nodes.find(n => n.id === nodeId);
        if (node) {
            node.position = position;
            this.state.isDirty = true;
        }
    }

    public updateNodeLabel(nodeId: string, newLabel: string): void {
        const node = this.state.data.nodes.find(n => n.id === nodeId);
        if (node) {
            node.label = newLabel;
            this.state.isDirty = true;
        }
    }

    public addEdge(edge: Edge): void {
        this.state.data.edges.push(edge);
        this.state.isDirty = true;
    }

    public removeEdge(edgeId: string): void {
        this.state.data.edges = this.state.data.edges.filter(e => e.id !== edgeId);
        this.state.isDirty = true;
    }

    public getData(): LineageData {
        return this.state.data;
    }

    public isDirty(): boolean {
        return this.state.isDirty;
    }
}