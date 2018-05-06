'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { channel } from '../extension';
import { FunctionTreeItem } from '../extension-tree/FunctionTreeItem';

const base64 = require('base-64');
const fs = require('fs-extra');

export async function deploy(functionTreeItem: FunctionTreeItem): Promise<void> {
    let configFile;
    let codeFile;

    channel.appendLine('Reading files from directory');

    // Assuming for now that folder contains yaml file and a single code file.
    fs.readdirSync(functionTreeItem.functionConfig.path).forEach(async file => {
        var ext = getExtension(file);
        switch (ext) {
            // TODO: Add try catch..
            case 'yaml':
                configFile = fs.readJsonSync(path.join(functionTreeItem.functionConfig.path, file));
                break;
            default:
                codeFile = base64.encode(fs.readFileSync(path.join(functionTreeItem.functionConfig.path, file), 'utf8'));
        }
    });

    configFile.spec.build['functionSourceCode'] = codeFile;

    channel.appendLine('Deploying function...');

    await functionTreeItem.dashboard.createFunction(functionTreeItem.projectName, configFile);
    vscode.window.showInformationMessage('Function deployed successfully');
    channel.appendLine('Function deployed successfully');
}

function getExtension(filename: string) {
    return filename.split('.').pop();
}