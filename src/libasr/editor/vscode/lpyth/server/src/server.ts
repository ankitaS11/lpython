/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { Position } from 'vscode-languageserver-protocol';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

import fs = require('fs');
import tmp = require('tmp');
import path = require('path');

import util = require('node:util');
import { TextEncoder } from 'node:util';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const exec = util.promisify(require('node:child_process').exec);

const tmpFile = tmp.fileSync();

function includeFlagForPath(file_path: string): string {
	const protocol_end = file_path.indexOf("://");
	if (protocol_end == -1) return " -I " + file_path;
	// Not protocol.length + 3, include the last '/'
	return " -I " + path.dirname(file_path.slice(protocol_end + 2));
}

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}

	console.log('LPython language server initialized');
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
	compiler: {
		executablePath: string;
	};
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000, compiler: { executablePath: "/home/ankita/Documents/Internships/GSI/lpython/src/bin/lpython" } };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	console.log("onDidChangeConfiguration, hasConfigurationCapability: " + hasConfigurationCapability);
	console.log("change is " + JSON.stringify(change));
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.LPythonLanguageServer || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'LPythonLanguageServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function throttle(fn: (...args: any) => void, delay: number) {
	let shouldWait = false;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let waitingArgs: any | null;
	const timeoutFunc = () => {
		if (waitingArgs == null) {
			shouldWait = false;
		} else {
			fn(...waitingArgs);
			waitingArgs = null;
			setTimeout(timeoutFunc, delay);
		}
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (...args: any) => {
		if (shouldWait) {
			waitingArgs = args;
			return;
		}

		fn(...args);
		shouldWait = true;

		setTimeout(timeoutFunc, delay);
	};
}

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((
	() => {
		const throttledValidateTextDocument = throttle(validateTextDocument, 500);
		return (change) => {
			throttledValidateTextDocument(change.document);
		};
	}
)());

function lowerBoundBinarySearch(arr: number[], num: number): number {
	let low = 0;
	let mid = 0;
	let high = arr.length - 1;

	if(num >= arr[high]) return high;

	while (low < high) {
		// Bitshift to avoid floating point division
		mid = (low + high) >> 1;

		if(arr[mid] < num) {
			low = mid + 1;
		} else {
			high = mid;
		}
	}

	return low - 1;
}

function convertSpan(utf8_offset: number, lineBreaks: Array<number>): Position {
	const lineBreakIndex = lowerBoundBinarySearch(lineBreaks, utf8_offset);

	const start_of_line_offset = lineBreakIndex == -1 ? 0 : (lineBreaks[lineBreakIndex] + 1);
	const character = utf8_offset - start_of_line_offset;

	return { line: lineBreakIndex + 1, character };
}

function convertPosition(position: Position, text: string): number {
	let line = 0;
	let character = 0;
	const buffer = new TextEncoder().encode(text);

	let i = 0;
	while (i < text.length) {
		if (line == position.line && character == position.character) {
			return i;
		}

		if (buffer.at(i) == 0x0A) {
			line++;
			character = 0;
		} else {
			character++;
		}

		i++;
	}

	return i;
}

async function runCompiler(text: string, flags: string, settings: ExampleSettings): Promise<string> {
	try {
		fs.writeFileSync(tmpFile.name, text);
	} catch (error) {
		console.log(error);
	}

	let stdout: string;
	try {
		const output = await exec(`${settings.compiler.executablePath} ${flags} ${tmpFile.name}`);
		// console.log(output);
		stdout = output.stdout;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (e: any) {
		stdout = e.stdout;
		if (e.signal != null) {
			console.log("compile failed: ");
			console.log(e);
		} else {
			console.log("Error:", e);
		}
	}

	return stdout;
}

function findLineBreaks(utf16_text: string): Array<number> {
	const utf8_text = new TextEncoder().encode(utf16_text);
	const lineBreaks: Array<number> = [];

	for (let i = 0; i < utf8_text.length; ++i) {
		if (utf8_text[i] == 0x0a) {
			lineBreaks.push(i);
		}
	}

	return lineBreaks;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	console.time('validateTextDocument');
	if (!hasDiagnosticRelatedInformationCapability) {
		console.error('Trying to validate a document with no diagnostic capability');
		return;
	}

	// // In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();

	const lineBreaks = findLineBreaks(text);

	const stdout = await runCompiler(text, "--show-errors" + includeFlagForPath(textDocument.uri), settings);

	const diagnostics: Diagnostic[] = [];

	// FIXME: We use this to deduplicate type hints given by the compiler.
	//        It'd be nicer if it didn't give duplicate hints in the first place.
	const seenTypeHintPositions = new Set();

	const lines = stdout.split('\n').filter(l => l.length > 0);
	for (const line of lines) {
		// console.log(line);
		try {
			const obj = JSON.parse(line);

			// HACK: Ignore everything that isn't about file ID #1 here, since that's always the current editing buffer.
			if (obj.file_id != 1) {
				continue;
			}
			if (obj.type == "diagnostic") {
				let severity: DiagnosticSeverity = DiagnosticSeverity.Error;

				switch (obj.severity) {
					case "Information": severity = DiagnosticSeverity.Information; break;
					case "Hint": severity = DiagnosticSeverity.Hint; break;
					case "Warning": severity = DiagnosticSeverity.Warning; break;
					case "Error": severity = DiagnosticSeverity.Error; break;
				}

				const position_start = convertSpan(obj.span.start, lineBreaks);
				const position_end   = convertSpan(obj.span.end,   lineBreaks);

				const diagnostic: Diagnostic = {
					severity,
					range: {
						start: position_start,
						end: position_end
					},
					message: obj.message,
					source: textDocument.uri
				};

				// console.log(diagnostic);

				diagnostics.push(diagnostic);
			} else if (obj.type == "hint") {
				if (!seenTypeHintPositions.has(obj.position)) {
					seenTypeHintPositions.add(obj.position);
					const position = convertSpan(obj.position, lineBreaks);
					const hint_string = ": " + obj.typename;
					const hint = InlayHint.create(position, [InlayHintLabelPart.create(hint_string)], InlayHintKind.Type);

					textDocument.jaktInlayHints.push(hint);
				}
			}
		} catch (e) {
			console.error(e);
		}

	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
	console.timeEnd('validateTextDocument');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
