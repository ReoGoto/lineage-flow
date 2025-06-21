import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';

function getNonce() {
    return crypto.randomBytes(16).toString('base64');
}

export class LineageViewerPanel {
    public static currentPanel: LineageViewerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;

        // Set the webview's initial html content
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'nodePositionChanged':
                        // TODO: Save node positions to JSON file
                        console.log('Node positions changed:', message.positions);
                        break;
                }
            },
            null,
            this._disposables
        );

        // Load initial data
        this._loadData();
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (LineageViewerPanel.currentPanel) {
            LineageViewerPanel.currentPanel._panel.reveal(column);
            return;
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';">
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
                physics: {
                    enabled: true,
                    hierarchicalRepulsion: {
                        nodeDistance: 150
                    },
                    solver: 'hierarchicalRepulsion'
                },
                manipulation: {
                    enabled: false
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
                }
            });

            // Handle network events
            network.on('dragEnd', function(params) {
                if (params.nodes.length > 0) {
                    const nodePositions = {};
                    params.nodes.forEach(nodeId => {
                        const position = network.getPositions([nodeId])[nodeId];
                        nodePositions[nodeId] = position;
                    });
                    // Send node positions back to extension
                    vscode.postMessage({
                        type: 'nodePositionChanged',
                        positions: nodePositions
                    });
                }
            });
        })();
    </script>
</body>
</html>`;
    }

    private _loadData() {
        // Sample data for testing
        const data = {
            nodes: [
                { id: 'T1', label: 'Table1', group: 'table' },
                { id: 'C1_1', label: 'Column1_1', group: 'column' },
                { id: 'C1_2', label: 'Column1_2', group: 'column' },
                { id: 'T2', label: 'Table2', group: 'table' },
                { id: 'C2_1', label: 'Column2_1', group: 'column' },
            ],
            edges: [
                { id: 'E1', from: 'C1_1', to: 'C2_1', label: 'Sample transformation' }
            ]
        };

        this._panel.webview.postMessage({
            type: 'updateData',
            nodes: data.nodes,
            edges: data.edges
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