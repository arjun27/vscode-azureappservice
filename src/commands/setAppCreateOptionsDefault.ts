/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { Uri, workspace, WorkspaceConfiguration } from 'vscode';
import { IAppCreateOptions, javaUtils, LinuxRuntimes, WebsiteOS } from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix } from '../constants';

export async function setAppCreateOptionsDefault(actionContext: IActionContext): Promise<IAppCreateOptions> {
    const isJavaProject: boolean = await javaUtils.isJavaProject();
    const createOptions: IAppCreateOptions = {};
    createOptions.actionContext = actionContext;
    if (isJavaProject) {
        createOptions.recommendedSiteRuntime = [
            LinuxRuntimes.java,
            LinuxRuntimes.tomcat,
            LinuxRuntimes.wildfly
        ];
    }
    // only detect if one workspace is opened
    if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
        const fsPath: string = workspace.workspaceFolders[0].uri.fsPath;
        if (await fse.pathExists(path.join(fsPath, 'package.json'))) {
            createOptions.recommendedSiteRuntime = [LinuxRuntimes.node];
        } else if (await fse.pathExists(path.join(fsPath, 'requirements.txt'))) {
            // requirements.txt are used to pip install so a good way to determine it's a Python app
            createOptions.recommendedSiteRuntime = [LinuxRuntimes.python];
        }
    }

    const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix);
    const advancedCreation: boolean | undefined = workspaceConfig.get(configurationSettings.advancedCreation);
    createOptions.advancedCreation = advancedCreation;
    if (!advancedCreation) {
        createOptions.location = 'centralus';
        if (isJavaProject) {
            // considering high resource requirement for Java applications, a higher plan sku is set here
            createOptions.planSku = { name: 'P1v2', tier: 'PremiumV2', size: 'P1v2', family: 'P', capacity: 1 };
            // to avoid 'Requested features are not supported in region' error
            createOptions.location = 'westeurope';
        }
        // we only set the OS for the non-advanced creation scenario
        // tslint:disable-next-line:strict-boolean-expressions
        if (createOptions.recommendedSiteRuntime) {
            createOptions.os = WebsiteOS.linux;
        } else {
            await workspace.findFiles('*.csproj').then((files: Uri[]) => {
                if (files.length > 0) {
                    createOptions.os = WebsiteOS.windows;
                }
            });
        }
    }

    return createOptions;
}