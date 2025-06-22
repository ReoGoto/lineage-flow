import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { LineageDataManager } from './model/LineageDataManager';
import { LineageData } from './model/types';

function getNonce() {
    return crypto.randomBytes(16).toString('base64');
}

export class LineageViewerPanel {
    public static currentPanel: LineageViewerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private readonly _dataManager: LineageDataManager;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._dataManager = LineageDataManager.getInstance();

        // Set the webview's initial html content
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'nodePositionChanged':
                        // Update node positions in the data manager
                        Object.entries(message.positions).forEach(([nodeId, position]) => {
                            const node = this._dataManager.getVisData().nodes.find(n => n.id === nodeId);
                            if (node) {
                                if (node.group === 'table') {
                                    this._dataManager.updateTablePosition(nodeId, position as any);
                                } else if (node.parent) {
                                    this._dataManager.updateColumnPosition(node.parent, nodeId, position as any);
                                }
                            }
                        });
                        break;
                    case 'editNodeLabel':
                        // Show input box for editing node label
                        const newLabel = await vscode.window.showInputBox({
                            value: message.currentLabel,
                            prompt: `Enter new ${message.group} name`,
                            validateInput: text => {
                                return text.trim() ? null : 'Name cannot be empty';
                            }
                        });
                        
                        if (newLabel !== undefined) {
                            const node = this._dataManager.getVisData().nodes.find(n => n.id === message.nodeId);
                            if (node) {
                                if (node.group === 'table') {
                                    this._dataManager.updateTableName(message.nodeId, newLabel.trim());
                                } else if (node.parent) {
                                    this._dataManager.updateColumnName(node.parent, message.nodeId, newLabel.trim());
                                }
                            }
                            this._panel.webview.postMessage({
                                type: 'updateNodeLabel',
                                nodeId: message.nodeId,
                                newLabel: newLabel.trim()
                            });
                        }
                        break;
                    case 'edgeAdded':
                        this._dataManager.addLineage({
                            id: message.edge.id,
                            source: message.edge.from,
                            target: message.edge.to,
                            description: message.edge.label,
                            arrows: message.edge.arrows
                        });
                        break;
                    case 'edgeDeleted':
                        this._dataManager.removeLineage(message.edge.id);
                        break;
                    case 'exportImage':
                        // Handle image export
                        if (message.imageData) {
                            const data = message.imageData.replace(/^data:image\/\w+;base64,/, '');
                            await fs.promises.writeFile(message.path, Buffer.from(data, 'base64'));
                            vscode.window.showInformationMessage(`Diagram exported to ${message.path}`);
                        }
                        break;
                }
            },
            null,
            this._disposables
        );

        // Load initial data
        this._loadData();
    }

    public get webview(): vscode.Webview {
        return this._panel.webview;
    }

    public updateData(data: LineageData) {
        const visData = this._dataManager.getVisData();
        this._panel.webview.postMessage({
            type: 'updateData',
            nodes: visData.nodes,
            edges: visData.edges
        });
    }

    public static createOrShow(extensionUri: vscode.Uri): LineageViewerPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (LineageViewerPanel.currentPanel) {
            LineageViewerPanel.currentPanel._panel.reveal(column);
            return LineageViewerPanel.currentPanel;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'lineageViewer',
            'Data Lineage Viewer',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'src', 'webview'),
                    vscode.Uri.joinPath(extensionUri, 'node_modules')
                ]
            }
        );

        LineageViewerPanel.currentPanel = new LineageViewerPanel(panel, extensionUri);
        return LineageViewerPanel.currentPanel;
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
        // Get the local path to vis-network
        const visNetworkPath = vscode.Uri.joinPath(extensionUri, 'node_modules', 'vis-network', 'standalone', 'umd', 'vis-network.min.js');
        const visNetworkUri = webview.asWebviewUri(visNetworkPath);

        // Use CSP to allow loading local resources
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-eval' 'unsafe-inline' 'nonce-${nonce}';">
    <title>Data Lineage Viewer</title>
    <script nonce="${nonce}" type="text/javascript" src="${visNetworkUri}"></script>
    <style>
        body, html {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
        }
        #network {
            width: 100%;
            height: 100%;
            background-color: var(--vscode-editor-background);
        }
        .vis-network {
            outline: none;
        }
    </style>
</head>
<body>
    <div id="network"></div>
    <script nonce="${nonce}">
        (function() {
            const vscode = acquireVsCodeApi();

            // Create a data object with nodes and edges
            const nodes = new vis.DataSet([]);
            const edges = new vis.DataSet([]);

            // Create a network
            const container = document.getElementById('network');
            const data = {
                nodes: nodes,
                edges: edges
            };
            const options = {
                nodes: {
                    shape: 'box',
                    margin: 10,
                    font: {
                        color: 'var(--vscode-editor-foreground)'
                    }
                },
                edges: {
                    smooth: {
                        type: 'curvedCW',
                        roundness: 0.2
                    },
                    arrows: 'to',
                    color: {
                        color: 'var(--vscode-editor-foreground)',
                        highlight: 'var(--vscode-editor-foreground)',
                        hover: 'var(--vscode-editor-foreground)'
                    },
                    font: {
                        color: 'var(--vscode-editor-foreground)',
                        align: 'middle'
                    }
                },
                groups: {
                    table: {
                        shape: 'box',
                        color: {
                            background: 'var(--vscode-editor-background)',
                            border: 'var(--vscode-editor-foreground)',
                            highlight: {
                                background: 'var(--vscode-editor-background)',
                                border: 'var(--vscode-editor-foreground)'
                            }
                        },
                        borderWidth: 2,
                        padding: 20
                    },
                    column: {
                        shape: 'box',
                        color: {
                            background: 'var(--vscode-editor-background)',
                            border: 'var(--vscode-editor-foreground)',
                            highlight: {
                                background: 'var(--vscode-editor-selectionBackground)',
                                border: 'var(--vscode-editor-foreground)'
                            }
                        },
                        borderWidth: 1
                    }
                },
                physics: {
                    enabled: true,
                    hierarchicalRepulsion: {
                        nodeDistance: 150,
                        avoidOverlap: 1
                    },
                    solver: 'hierarchicalRepulsion'
                },
                manipulation: {
                    enabled: true,
                    addNode: false,
                    addEdge: function(edgeData, callback) {
                        // Only allow connections between columns
                        const fromNode = nodes.get(edgeData.from);
                        const toNode = nodes.get(edgeData.to);
                        if (fromNode.group === 'column' && toNode.group === 'column') {
                            edgeData.id = 'E' + Date.now();
                            callback(edgeData);
                            // Notify the extension about the new edge
                            vscode.postMessage({
                                type: 'edgeAdded',
                                edge: edgeData
                            });
                        }
                    },
                    deleteNode: false,
                    deleteEdge: function(edgeData, callback) {
                        callback(edgeData);
                        // Notify the extension about the deleted edge
                        vscode.postMessage({
                            type: 'edgeDeleted',
                            edge: edgeData
                        });
                    },
                    editEdge: false
                }
            };
            const network = new vis.Network(container, data, options);

            // Handle messages from the extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.type) {
                    case 'updateData':
                        nodes.clear();
                        edges.clear();
                        nodes.add(message.nodes);
                        edges.add(message.edges);
                        break;
                    case 'updateNodeLabel':
                        const node = nodes.get(message.nodeId);
                        if (node) {
                            node.label = message.newLabel;
                            nodes.update(node);
                        }
                        break;
                    case 'exportImage':
                        // Get network canvas
                        const canvas = container.getElementsByTagName('canvas')[0];
                        if (canvas) {
                            let imageData;
                            if (message.format === 'png') {
                                imageData = canvas.toDataURL('image/png');
                            } else if (message.format === 'svg') {
                                // Get SVG data
                                const svgData = network.getSVGString();
                                imageData = 'data:image/svg+xml;base64,' + btoa(svgData);
                            }
                            
                            if (imageData) {
                                vscode.postMessage({
                                    type: 'exportImage',
                                    imageData: imageData,
                                    path: message.path
                                });
                            }
                        }
                        break;
                }
            });

            // Handle network events
            network.on('dragStart', function(params) {
                if (params.nodes.length > 0) {
                    // Get the first selected node
                    const nodeId = params.nodes[0];
                    const node = nodes.get(nodeId);
                    
                    if (node.group === 'table') {
                        // When dragging a table, find all its columns
                        const columns = nodes.get().filter(n => n.parent === nodeId);
                        columns.forEach(column => {
                            // Store the initial relative position of each column
                            const tablePos = network.getPositions([nodeId])[nodeId];
                            const columnPos = network.getPositions([column.id])[column.id];
                            column._relativePos = {
                                x: columnPos.x - tablePos.x,
                                y: columnPos.y - tablePos.y
                            };
                        });
                    }
                }
            });

            network.on('dragging', function(params) {
                if (params.nodes.length > 0) {
                    // Get the first selected node
                    const nodeId = params.nodes[0];
                    const node = nodes.get(nodeId);
                    
                    if (node.group === 'table') {
                        // When dragging a table, update its columns' positions
                        const columns = nodes.get().filter(n => n.parent === nodeId);
                        const tablePos = network.getPositions([nodeId])[nodeId];
                        
                        columns.forEach(column => {
                            if (column._relativePos) {
                                network.moveNode(column.id, 
                                    tablePos.x + column._relativePos.x,
                                    tablePos.y + column._relativePos.y);
                            }
                        });
                    }
                }
            });

            network.on('dragEnd', function(params) {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const node = nodes.get(nodeId);
                    const position = network.getPositions([nodeId])[nodeId];
                    
                    if (node.group === 'table') {
                        // When a table drag ends, update all positions
                        const columns = nodes.get().filter(n => n.parent === nodeId);
                        const positions = {
                            [nodeId]: position
                        };
                        
                        columns.forEach(column => {
                            const columnPos = network.getPositions([column.id])[column.id];
                            positions[column.id] = columnPos;
                            // Clean up the temporary relative position
                            delete column._relativePos;
                        });

                        // Send all updated positions back to extension
                        vscode.postMessage({
                            type: 'nodePositionChanged',
                            positions: positions
                        });
                    } else if (node.group === 'column') {
                        // When a column drag ends, just update its position
                        vscode.postMessage({
                            type: 'nodePositionChanged',
                            positions: {
                                [nodeId]: position
                            }
                        });
                    }
                }
            });

            // Handle double click for editing labels
            network.on('doubleClick', function(params) {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const node = nodes.get(nodeId);
                    
                    // Send edit request to extension
                    vscode.postMessage({
                        type: 'editNodeLabel',
                        nodeId: nodeId,
                        currentLabel: node.label,
                        group: node.group
                    });
                }
            });
        })();
    </script>
</body>
</html>`;
    }

    private _loadData() {
        const data = this._dataManager.getData();
        if (data.tables.length === 0) {
            // Load sample data if no data exists
            data.tables = [
                {
                    id: 'T1',
                    name: 'Table1',
                    position: { x: 0, y: 0 },
                    columns: [
                        {
                            id: 'C1_1',
                            name: 'Column1_1'
                        },
                        {
                            id: 'C1_2',
                            name: 'Column1_2'
                        }
                    ]
                },
                {
                    id: 'T2',
                    name: 'Table2',
                    position: { x: 300, y: 0 },
                    columns: [
                        {
                            id: 'C2_1',
                            name: 'Column2_1'
                        }
                    ]
                }
            ];

            data.lineage = [
                {
                    id: 'E1',
                    source: 'C1_1',
                    target: 'C2_1',
                    description: 'Sample transformation',
                    arrows: 'to'
                }
            ];
        }

        const visData = this._dataManager.getVisData();
        this._panel.webview.postMessage({
            type: 'updateData',
            nodes: visData.nodes,
            edges: visData.edges
        });
    }

    public dispose() {
        LineageViewerPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}