import * as assert from 'assert';
import * as sinon from 'sinon';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import { ProjectFile } from '../config/projectFile';
import { SettingsFile } from '../config/settingsFile';
import { CreateFunction, FunctionRuntime } from '../function/createFunction';
import { Dashboard, LocalEnvironment, LocalProject, ProjectConfig } from '../nuclio';
import { CreateProject } from '../project/createProject';

// Notice- this test will deploy actuall project and function to nuclio.
suite('Create function tests', function (): void {
    const folderPath: tmp.SynchrounousResult = tmp.dirSync({ unsafeCleanup: true });
    const functionPath: tmp.SynchrounousResult = tmp.dirSync({ unsafeCleanup: true });

    test('function values are set as expected', async function (): Promise<void> {
        // Arrange
        const settingsFile: SettingsFile = new SettingsFile(folderPath.name);

        const name: string = 'env';
        const projName: string = 'proj name';
        const namespace: string = 'nuclio';
        const address: string = 'http://127.0.0.1:8070';
        const displayName: string = 'new proj';
        const localEnvironment: LocalEnvironment = new LocalEnvironment(name, namespace, address, []);

        const projectConfig: ProjectConfig = new ProjectConfig();
        projectConfig.metadata.name = projName;
        projectConfig.metadata.namespace = namespace;
        projectConfig.spec.displayName = displayName;

        await settingsFile.addNewEnvironmentAsync(localEnvironment);
        let localProject: LocalProject = new LocalProject(name, namespace, displayName, folderPath.name, []);
        const dashboard: Dashboard = new Dashboard(address);

        const functionName: string = 'func';

        const showOpenDialog: sinon.SinonStub = sinon.stub(vscode.window, "showOpenDialog");
        const showInputBox: sinon.SinonStub = sinon.stub(vscode.window, "showInputBox");
        const showQuickPick: sinon.SinonStub = sinon.stub(vscode.window, "showQuickPick");

        showInputBox.onCall(0).resolves(projName);
        showInputBox.onCall(1).resolves(''); // will validate that the env namespace was set if the namespace is empty
        showInputBox.onCall(2).resolves("project description");
        showOpenDialog.onFirstCall().resolves([vscode.Uri.file(folderPath.name)]);

        await CreateProject(localEnvironment, settingsFile);

        showInputBox.onCall(3).resolves(functionName);
        showInputBox.onCall(4).resolves(''); // will validate that the env namespace was set if the namespace is empty
        showOpenDialog.onSecondCall().resolves([vscode.Uri.file(functionPath.name)]);
        showQuickPick.resolves({ data: 'golang', label: FunctionRuntime.Go, description: '' });

        // Act
        await CreateFunction(localProject);

        // Validate - new function was written to project file and yaml
        const projectFile: ProjectFile = new ProjectFile(folderPath.name, settingsFile);
        localProject = projectFile.readFromFile();

        assert.equal(localProject.functions.length, 1);
        assert.equal(localProject.functions[0].name, functionName);
        assert.equal(localProject.functions[0].path.toLowerCase(), functionPath.name.toLowerCase());

        // Cleanup
        await dashboard.deleteFunction({ name: functionName, namespace: namespace, projectName: localProject.name });
        await dashboard.deleteProject({ namespace: namespace, name: localProject.name });
        showInputBox.restore();
        showOpenDialog.restore();
        showQuickPick.restore();
    });
});
