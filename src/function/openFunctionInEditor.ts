import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Open all the available files in functionPath in the editor.
 * @param functionPath - the path of the function files
 */
export async function openFunctionInEditorAsync(functionPath: string): Promise<void> {

    const file: vscode.Uri = vscode.Uri.file(functionPath);
    const files: string[] = fse.readdirSync(functionPath);
    for (const f of files) {
        const textDocument: vscode.TextDocument = await vscode.workspace.openTextDocument(path.join(functionPath, f));
        await vscode.window.showTextDocument(textDocument, { preview: false });
    }

    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: file });
}
