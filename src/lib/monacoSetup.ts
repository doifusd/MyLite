import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';

loader.config({ monaco });
