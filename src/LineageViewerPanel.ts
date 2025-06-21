import * as vscode from 'vscode';
import * as path from 'path';

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
                    vscode.Uri.joinPath(extensionUri, 'src', 'webview')
                ]
            }
        );

        LineageViewerPanel.currentPanel = new LineageViewerPanel(panel, extensionUri);
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
        const htmlPath = vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'lineageViewer.html');
        let htmlContent = '';
        try {
            htmlContent = require('fs').readFileSync(htmlPath.fsPath, 'utf8');
        } catch (err) {
            console.error('Error reading HTML file:', err);
            return 'Error loading webview content';
        }
        return htmlContent;
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