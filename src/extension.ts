import * as vscode from 'vscode';
import { LineageViewerPanel } from './LineageViewerPanel';
import { LineageDataManager } from './model/LineageDataManager';
import { ImageExporter } from './export/ImageExporter';
import { CsvImporter } from './model/CsvImporter';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "lineage-flow" is now active');

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('lineage-flow.openLineageViewer', () => {
            LineageViewerPanel.createOrShow(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lineage-flow.importFromCsv', async () => {
            try {
                const importedData = await CsvImporter.importFromCsv();
                
                // Update the viewer if it's open
                if (LineageViewerPanel.currentPanel) {
                    LineageViewerPanel.currentPanel.updateData(importedData);
                } else {
                    // Open the viewer if it's not open
                    const panel = LineageViewerPanel.createOrShow(context.extensionUri);
                    panel.updateData(importedData);
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
