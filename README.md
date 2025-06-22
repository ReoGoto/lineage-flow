# Data Lineage Viewer (lineage-flow)

A VS Code extension for visualizing, creating, and managing column-level data lineage diagrams with an intuitive UI. This extension helps data engineers, analysts, and developers understand and maintain data dependencies in their projects.

## Features

- Interactive visualization of data lineage using vis.js Network
- Drag-and-drop interface for arranging tables and columns
- Automatic edge (line) following when moving nodes
- Support for curved edges with directional arrows
- Visual distinction between table and column nodes
- Theme-aware styling that matches your VS Code theme

## Requirements

- Visual Studio Code version 1.101.0 or higher

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ReoGoto/lineage-flow.git
   ```

2. Install dependencies:
   ```bash
   cd lineage-flow
   npm install
   ```

3. Package the extension:
   ```bash
   npm install -g @vscode/vsce
   vsce package
   ```

4. Install the extension in VS Code:
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
   - Type "Install from VSIX"
   - Select the generated `.vsix` file

## Usage

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Open Data Lineage Viewer" and select the command
3. The lineage viewer will open in a new panel

## Known Issues

- Currently in early development (Phase 1)
- Sample data is hardcoded for testing purposes
- CSV import and JSON persistence not yet implemented

## Release Notes

### 0.0.1

Initial development release with basic functionality:
- Basic VS Code extension structure
- vis.js Network integration
- Webview panel for lineage graph display
- Basic node and edge rendering with sample data
- Support for dragging nodes with automatic edge following

## Contributing

This project is under active development. See the [GitHub repository](https://github.com/ReoGoto/lineage-flow) for more information.

## License

[MIT License](LICENSE)
