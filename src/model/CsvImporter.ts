import * as vscode from 'vscode';
import * as fs from 'fs';
import { parse } from 'csv-parse';
import { TableNode, ColumnNode } from './types';

export class CsvImporter {
    public static async importFromCsv(): Promise<{ nodes: (TableNode | ColumnNode)[], edges: [] }> {
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
            throw new Error('No file selected');
        }

        const csvFile = files[0];
        const csvContent = await fs.promises.readFile(csvFile.fsPath, 'utf-8');
        
        // Parse CSV content
        console.log('CSV content:', csvContent);
        
        const records = await new Promise<any[]>((resolve, reject) => {
            parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            }, (err, output) => {
                if (err) {
                    console.error('CSV parse error:', err);
                    reject(err);
                } else {
                    console.log('Parsed records:', output);
                    resolve(output);
                }
            });
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

        return {
            nodes,
            edges: []
        };
    }
}