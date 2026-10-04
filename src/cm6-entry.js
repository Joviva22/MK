// Fuente del mini-empaquetado de CodeMirror 6 (ver scripts/build-cm6.js y
// OBJETIVOS.md, "Migrar el editor a CodeMirror 6"). CM6 se instala como
// varios paquetes npm que se importan entre sí por nombre — el navegador no
// resuelve eso sin ayuda, así que esbuild los junta ACÁ, una vez, en
// src/cm6-bundle.js (committeado). En runtime sigue sin build: ese archivo
// se carga con un <script> normal, sin compilar al arrancar la app.
//
// Lenguajes nativos y parsers StreamLanguage para cubrir todos los modos
// del editor sin cargar scripts de CM5 bajo demanda.
import {
  EditorState, EditorSelection, Compartment, StateEffect, StateField, RangeSet, RangeSetBuilder, Prec
} from '@codemirror/state';
import {
  EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection,
  crosshairCursor, lineNumbers, highlightActiveLineGutter, Decoration, WidgetType, ViewPlugin
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, selectAll, undo, redo } from '@codemirror/commands';
import { searchKeymap, search, SearchCursor } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, completeAnyWord, startCompletion, closeCompletion, completionStatus } from '@codemirror/autocomplete';
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, HighlightStyle, StreamLanguage, LanguageSupport, ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { tags } from '@lezer/highlight';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { php } from '@codemirror/lang-php';
import { json } from '@codemirror/legacy-modes/mode/javascript';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { c as clikeC, cpp as clikeCpp, java as clikeJava, csharp, kotlin, scala, dart } from '@codemirror/legacy-modes/mode/clike';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { go } from '@codemirror/legacy-modes/mode/go';
import { rust } from '@codemirror/legacy-modes/mode/rust';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { r } from '@codemirror/legacy-modes/mode/r';
import { julia } from '@codemirror/legacy-modes/mode/julia';
import { haskell } from '@codemirror/legacy-modes/mode/haskell';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { sql } from '@codemirror/legacy-modes/mode/sql';
import { css } from '@codemirror/legacy-modes/mode/css';
import { xml } from '@codemirror/legacy-modes/mode/xml';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { toml } from '@codemirror/legacy-modes/mode/toml';

window.mdCM6 = {
  EditorState, EditorSelection, Compartment, StateEffect, StateField, RangeSet, RangeSetBuilder, Prec,
  EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor,
  rectangularSelection, crosshairCursor, lineNumbers, highlightActiveLineGutter,
  Decoration, WidgetType, ViewPlugin,
  defaultKeymap, history, historyKeymap, indentWithTab, selectAll, undo, redo,
  searchKeymap, search, SearchCursor,
  autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, completeAnyWord, startCompletion, closeCompletion, completionStatus,
  indentOnInput, syntaxHighlighting, defaultHighlightStyle, HighlightStyle, StreamLanguage, LanguageSupport, ensureSyntaxTree, syntaxTree,
  markdown, markdownLanguage, GFM, tags, python, javascript, html, php,
  legacyModes: { stex, clikeC, clikeCpp, clikeJava, shell, csharp, kotlin, scala, dart, ruby, go, rust, perl, lua, r, julia, haskell, swift, powerShell, sql, css, xml, yaml, toml, json }
};
