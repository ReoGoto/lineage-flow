import * as vscode from 'vscode';
import { LineageViewerPanel } from './LineageViewerPanel';
import { LineageDataManager } from './model/LineageDataManager';
import { ImageExporter } from './export/ImageExporter';

const outputChannel = vscode.window.createOutputChannel('Lineage Flow');

export function activate(context: vscode.ExtensionContext) {
    outputChannel.appendLine('Extension "lineage-flow" is now active');
    outputChannel.appendLine('Extension path: ' + context.extensionPath);
    outputChannel.show();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('lineage-flow.openLineageViewer', () => {
            outputChannel.appendLine('Executing command: openLineageViewer');
            try {
                const panel = LineageViewerPanel.createOrShow(context.extensionUri);
                outputChannel.appendLine('Viewer panel created successfully');
            } catch (error) {
                outputChannel.appendLine('Error creating viewer panel: ' + (error as Error).message);
                outputChannel.appendLine('Stack trace: ' + (error as Error).stack);
                throw error;
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lineage-flow.importFromCsv', async () => {
            try {
                const dataManager = LineageDataManager.getInstance();
                await dataManager.importFromCsv();
                
                // Update the viewer if it's open
                if (LineageViewerPanel.currentPanel) {
                    LineageViewerPanel.currentPanel.updateData(dataManager.getData());
                } else {
                    // Open the viewer if it's not open
                    const panel = LineageViewerPanel.createOrShow(context.extensionUri);
                    panel.updateData(dataManager.getData());
                }

                vscode.window.showInformationMessage('CSV imported successfully');
            } catch (error) {
                vscode.window.showErrorMessage('Failed to import CSV: ' + (error as Error).message);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lineage-flow.exportToImage', () => {
            if (LineageViewerPanel.currentPanel) {
                ImageExporter.exportToImage(LineageViewerPanel.currentPanel.webview);
            } else {
                vscode.window.showErrorMessage('Please open the Data Lineage Viewer first');
            }
        })
    );

    // Register auto-save when VS Code is about to close
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(async () => {
            const dataManager = LineageDataManager.getInstance();
            if (dataManager.isDirty()) {
                await dataManager.saveToJson();
            }
        })
    );
}

export function deactivate() {}
