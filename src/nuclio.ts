/*
Copyright 2017 The Nuclio Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import axios from 'axios';

export interface IPlatform {

    // create a single project given a configuration
    createProject(projectConfig: ProjectConfig): Promise<ProjectConfig>;

    // get a set of projects matching a filter
    getProjects(filter: IProjectFilter): Promise<ProjectConfig[]>;

    // delete a project
    deleteProject(id: IResourceIdentifier): Promise<void>;

    // create a single function given a configuration
    createFunction(projectName: string, functionConfig: FunctionConfig): Promise<FunctionConfig | void>;

    // invoke a function
    invokeFunction(id: IResourceIdentifier, options: IInvokeOptions): Promise<InvokeResult>;

    // get a set of functions matching a filter
    getFunctions(filter: IFunctionFilter): Promise<FunctionConfig[]>;

    // delete a function
    deleteFunction(id: IResourceIdentifier): Promise<void>;
}

export class EnvironmentsConfig {
    environments: LocalEnvironment[];

    constructor() {
        this.environments = [];
    }
}

export class LocalEnvironment {
    constructor(
        public readonly name: string,
        public readonly namespace: string,
        public readonly address: string,
        public projects: { name: string, path: string }[]) {
    }
}

export class LocalProject {
    constructor(public name: string, public displayName: string, public path: string, public functions: LocalFunction[]) {
    }
}

export class LocalFunction {
    constructor(public readonly name: string, public readonly namespace: string, public readonly path: string) {
    }
}

export class ResourceMeta {
    name: string;
    namespace: string;
    labels: { [key: string]: string };
    annotations: { [key: string]: string };
}

export class ProjectSpec {
    displayName: string;
    description: string;
}

export class ProjectConfig {
    metadata: ResourceMeta;
    spec: ProjectSpec;

    constructor() {
        this.metadata = new ResourceMeta();
        this.spec = new ProjectSpec();
    }
}

export interface IInvokeOptions {
    method: string;
    logLevel?: string;
    path?: string;
    headers?: { [key: string]: any };
    body?: any;
    via?: string;
}

export class InvokeResult {
    statusCode: number;
    headers: { [key: string]: any };
    body: any;
}

export interface IResourceIdentifier {
    namespace: string;
    name?: string;
}

// tslint:disable-next-line:no-empty-interface
export interface IProjectFilter extends IResourceIdentifier { }

export interface IFunctionFilter extends IResourceIdentifier {
    projectName?: string;
}

export class Env {
    name: string;
    value: string;
}

export class DataBinding {
    name: string;
    class: string;
    kind: string;
    url: string;
    path: string;
    query: string;
    secret: string;
    attributes: any;
}

export class Trigger {
    class: string;
    kind: string;
    disabled: boolean;
    maxWorkers: number;
    url: string;
    paths: string[];
    numPartitions: number;
    user: string;
    secret: string;
    attributes: any;
}

export class Build {
    path: string;
    functionSourceCode: string;
    functionConfigPath: string;
    tempDir: string;
    registry: string;
    image: string;
    noBaseImagePull: boolean;
    noCache: boolean;
    noCleanup: boolean;
    baseImage: string;
    commands: string[];
    scriptPaths: string[];
    addedObjectPaths: { [localPath: string]: string };
}

export class FunctionSpec {
    description: string;
    disabled: boolean;
    handler: string;
    runtime: string;
    env: Env[];
    image: string;
    imageHash: string;
    replicas: number;
    minReplicas: number;
    maxReplicas: number;
    dataBindings: { [name: string]: DataBinding };
    triggers: { [name: string]: Trigger };
    build: Build;
    runRegistry: string;
    runtimeAttributes: any;

    constructor() {
        this.build = new Build();
    }
}

export class FunctionStatus {
    state: string;
    message: string;
    httpPort: number;
}

export class FunctionConfig {
    metadata: ResourceMeta;
    spec: FunctionSpec;
    status: FunctionStatus;

    constructor() {
        this.metadata = new ResourceMeta();
        this.spec = new FunctionSpec();
        this.status = new FunctionStatus();
    }
}

export class Dashboard implements IPlatform {
    public url: string;

    constructor(url: string) {
        this.url = url;
    }

    // create a single project given a configuration
    async createProject(projectConfig: ProjectConfig): Promise<ProjectConfig> {
        const body: string = JSON.stringify(projectConfig);

        // create function by posting function config
        const result: any = await axios.post(`${this.url}/api/projects`, body);
        return result.data;
    }

    // get a set of projects matching a filter
    async getProjects(filter: IProjectFilter): Promise<ProjectConfig[]> {
        return await this.getResources(filter, 'project', ProjectConfig);
    }

    // delete a project
    async deleteProject(id: IResourceIdentifier): Promise<void> {
        return this.deleteResource(id, 'project', ProjectConfig);
    }

    async createFunction(projectName: string, functionConfig: FunctionConfig): Promise<FunctionConfig | void> {

        // create labels if not created and set the project name label
        functionConfig.metadata.labels = functionConfig.metadata.labels ? functionConfig.metadata.labels : {};
        functionConfig.metadata.labels['nuclio.io/project-name'] = projectName;

        const body: string = JSON.stringify(functionConfig);

        // create function by posting function config
        await axios.post(`${this.url}/api/functions`, body);

        const retryIntervalMs: number = 1000;
        const maxRetries: number = 60;

        // poll for retryIntervalMs * maxRetries. the function is being created and we need for it
        // to become ready or to fail
        for (let retryIdx: number = 0; retryIdx < maxRetries; retryIdx++) {
            let createdFunctionConfig: FunctionConfig[];

            try {

                // try to get functions. this can fail in the local platform, as it may return 404 at this point
                createdFunctionConfig = await this.getFunctions({
                    name: functionConfig.metadata.name,
                    namespace: functionConfig.metadata.namespace
                });
            } catch (e) {
                createdFunctionConfig = [];
            }

            // if we got a function
            if (createdFunctionConfig.length) {

                // if the function is ready, we're done
                if (createdFunctionConfig[0].status.state === 'ready') {
                    return createdFunctionConfig[0];
                }

                // if the function is in error state, explode
                if (createdFunctionConfig[0].status.state === 'error') {
                    throw new Error(`Creation failed: ${createdFunctionConfig[0].status.message}`);
                }
            }

            // wait a bit
            await new Promise((resolve: any): number => setTimeout(resolve, retryIntervalMs));
        }
    }

    async invokeFunction(id: IResourceIdentifier, options: IInvokeOptions): Promise<InvokeResult> {

        // name must be passed
        if (id.name === undefined) {
            throw new Error('Function name must be specified in invoke');
        }

        // get headers from options or create a new object
        const headers: { [key: string]: any } = options.headers ? options.headers : {};
        headers['x-nuclio-function-name'] = id.name;
        headers['x-nuclio-function-namespace'] = id.namespace;
        headers['x-nuclio-invoke-via'] = options.via ? options.via : 'external-ip';

        if (options.path !== undefined) {
            headers['x-nuclio-path'] = options.path;
        }

        let response: any;
        const url: string = `${this.url}/api/function_invocations`;
        const axiosMethod: any = axios[options.method];

        // invoke the function by calling the appropriate method on function_invocations
        if (['post', 'put', 'path'].includes(options.method)) {
            response = await axiosMethod(url, options.body, { headers: headers });
        } else {
            response = await axiosMethod(url, { headers: headers });
        }

        const invokeResult: InvokeResult = new InvokeResult();
        invokeResult.statusCode = response.status;
        invokeResult.headers = response.headers;
        invokeResult.body = response.data;

        return invokeResult;
    }

    // get a set of functions matching a filter
    async getFunctions(filter: IFunctionFilter): Promise<FunctionConfig[]> {
        const headers: {} = {};

        // set project name filter
        if (filter.projectName !== undefined) {
            headers['x-nuclio-project-name'] = filter.projectName;
        }

        return await this.getResources(filter, 'function', FunctionConfig, headers);
    }

    // delete functions
    async deleteFunction(id: IFunctionFilter): Promise<void> {
        return this.deleteResource(id, 'function', FunctionConfig);
    }

    // get resources
    async getResources(filter: IResourceIdentifier, resourceName: string, resourceClass: any, headers?: any): Promise<any> {

        // headers will filter namespace
        headers = headers ? headers : {};
        headers[`x-nuclio-${resourceName}-namespace`] = filter.namespace;

        // url is resource name (plural)
        let path: string = `/api/${resourceName}s`;

        if (filter.name !== undefined) {
            path += `/${filter.name}`;
        }

        const resources: any[] = [];
        let responseResources: {} = {};

        // get functions, filtered by the filter
        const response: any = await axios.get(this.url + path, { headers: headers });

        // if name was passed, we get a single entity. wrap it in an array to normalize it
        if (filter.name !== undefined) {
            // tslint:disable-next-line:no-string-literal
            responseResources['single'] = response.data;
        } else {
            responseResources = response.data;
        }

        // iterate over response which is {resourceName: resourceConfig} and create the appropriate object
        for (const name of Object.keys(responseResources)) {
            const resource: any = new resourceClass();

            // assign the object
            Object.assign(resource, responseResources[name]);
            resources.push(resource);
        }

        return resources;
    }

    // delete functions
    async deleteResource(id: IResourceIdentifier, resourceName: string, resourceClass: any): Promise<void> {

        // name must be passed
        if (id.name === undefined) {
            throw new Error('Resource name must be specified in delete');
        }

        const resource: any = new resourceClass();
        resource.metadata.name = id.name;
        resource.metadata.namespace = id.namespace;

        // delete the function
        await axios.delete(`${this.url}/api/${resourceName}s`, { data: JSON.stringify(resource) });
    }
}
