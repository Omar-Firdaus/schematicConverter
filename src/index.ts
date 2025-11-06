#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { SExpressionParser } from './parser';
import { SchematicParser } from './schematicParser';
import { ContextBuilder } from './contextBuilder';

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('you need to provide a path to a file');
    console.error('like this: ts-node src/index.ts file path');
    process.exit(1);
  }

  const filePath = args[0];

  if (!fs.existsSync(filePath)) {
    console.error(`theres no file at that path`);
    process.exit(1);
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.sch' && ext !== '.kicad_sch') {
    console.warn(`you're not using the right file extension`);
  }

  try {
    console.log('Reading schematic...');
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    console.log('Parsing complete.');
    const parser = new SExpressionParser(fileContent);
    const root = parser.parse();

    const schematicParser = new SchematicParser(root);
    const parsedSchematic = schematicParser.parse();

    const contextBuilder = new ContextBuilder(parsedSchematic);
    const context = contextBuilder.build(filePath);

    const outputPath = path.join(process.cwd(), 'context.json');
    fs.writeFileSync(outputPath, JSON.stringify(context, null, 2), 'utf-8');

    console.log('file w context saved as context.json.');
  } catch (error) {
    console.error('something went wrong:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
