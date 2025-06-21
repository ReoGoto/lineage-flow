import * as vscode from 'vscode';
import { LineageViewerPanel } from './LineageViewerPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "lineage-flow" is now active');

    const disposable = vscode.commands.registerCommand('lineage-flow.openLineageViewer', () => {
        LineageViewerPanel.createOrShow(context.extensionUri);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
