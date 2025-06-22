import * as vscode from 'vscode';

export class ImageExporter {
    public static async exportToImage(webview: vscode.Webview): Promise<void> {
        const format = await vscode.window.showQuickPick(
            ['PNG', 'SVG'],
            {
                placeHolder: 'Select export format'
            }
        );

        if (!format) {
            return;
        }

        const file = await vscode.window.showSaveDialog({
            filters: {
                'Image files': [format.toLowerCase()]
            },
            title: 'Export Lineage Diagram'
        });

        if (!file) {
            return;
        }

        // Request image data from webview
        webview.postMessage({
            type: 'exportImage',
            format: format.toLowerCase(),
            path: file.fsPath
        });
    }
}