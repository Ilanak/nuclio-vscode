import * as base64 from 'base-64';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { channel } from '../extension';
import { FunctionTreeItem } from '../extension-tree/FunctionTreeItem';
import { FunctionConfig } from '../nuclio';

export async function deploy(functionTreeItem: FunctionTreeItem): Promise<void> {
    let configFile: FunctionConfig;
    let codeFile: string;

    channel.appendLine('Reading files from directory');

    // Assuming for now that folder contains yaml file and a single code file.
    fse.readdirSync(functionTreeItem.functionConfig.path).forEach(async (file: string) => {
        const ext: string = getExtension(file);
        switch (ext) {
            // TODO: Add try catch..
            case 'yaml':
                configFile = fse.readJsonSync(path.join(functionTreeItem.functionConfig.path, file));
                break;
            default:
                codeFile = base64.encode(fse.readFileSync(path.join(functionTreeItem.functionConfig.path, file), 'utf8'));
        }
    });

    configFile.spec.build.functionSourceCode = codeFile;

    channel.appendLine('Deploying function...');

    try {
        await functionTreeItem.dashboard.createFunction(functionTreeItem.projectName, configFile);
    } catch (ex) {
        vscode.window.showErrorMessage(`Error deploying the function`);
        channel.appendLine(`Error deploying the function: ${ex}`);
        return;
    }

    vscode.window.showInformationMessage('Function deployed successfully');
    channel.appendLine('Function deployed successfully');
}

function getExtension(filename: string): string {
    return filename.split('.').pop();
}
