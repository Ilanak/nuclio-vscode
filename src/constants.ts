export enum ContextValues {
    function = 'function',
    project = 'project',
    environment = 'environment'
}

export const iconFileName: string = 'nuclioIcon.svg';

export const defaultNamespace: string = 'nuclio';

export const extensionPrefix: string = 'nuclio';

export const userConfigurationDir: string = '.nuclio-vscode';

export const userConfigurationFileName: string = 'nuclio.json';

export const goHandlerCode: string = `package main

import (
    "github.com/nuclio/nuclio-sdk-go"
)

func Handler(context *nuclio.Context, event nuclio.Event) (interface{}, error) {
    return nil, nil
}`;

export const pythonHandlerCode: string = `def Handler(context, event):
    pass`;

export const nodejsHandlerCode: string = `exports.handler = function (context, event) {
};`;

export const dotNetCoreHandlerCode: string = `
using System;
using Nuclio.Sdk;

public class main
{
    public object handler(Context context, Event eventBase)
    {
        return new Response()
        {
            StatusCode = 200,
            ContentType = "application/text",
            Body = ""
        };
    }
}`;

export const javaHandlerCode: string = `
import io.nuclio.Context;
import io.nuclio.Event;
import io.nuclio.EventHandler;
import io.nuclio.Response;

public class Handler implements EventHandler {

    @Override
    public Response handleEvent(Context context, Event event) {
       return new Response().setBody("");
    }
}`;
